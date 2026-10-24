import type { Ctx } from "@/lib/auth/require-user";
import { addDaysIso, localDateTimeToUtc, parseIsoDate, toIsoDate, utcToLocalParts } from "@/lib/dates";
import { forUser } from "@/lib/db/tenant";
import { notFound, validationError } from "@/lib/errors";
import type { Clock } from "@/modules/shared/clock";
import { isScheduledOn, type HabitLike } from "@/modules/habits/streaks";
import type { EventInput } from "./schema";
import type { CalendarItem, CalendarRange, EventDTO, HabitDaySummary } from "./types";

const TASK_CAP = 500;

const toEventDTO = (e: { id: string; title: string; type: EventDTO["type"]; startsAt: Date; endsAt: Date | null; allDay: boolean; location: string | null; notes: string | null; clientId: string | null; client?: { name: string } | null }, timeZone: string): EventDTO => {
  const start = utcToLocalParts(e.startsAt, timeZone);
  return {
    id: e.id,
    title: e.title,
    type: e.type,
    allDay: e.allDay,
    date: start.iso,
    startTime: e.allDay ? null : start.time,
    endTime: e.allDay || !e.endsAt ? null : utcToLocalParts(e.endsAt, timeZone).time,
    location: e.location,
    notes: e.notes,
    clientId: e.clientId,
    clientName: e.client?.name ?? null,
  };
};

export async function getEvent(ctx: Ctx, id: string, timeZone: string): Promise<EventDTO | null> {
  const e = await forUser(ctx.userId).calendarEvent.findFirst({ where: { id, deletedAt: null }, include: { client: { select: { name: true } } } });
  return e ? toEventDTO(e, timeZone) : null;
}

export async function saveEvent(ctx: Ctx, input: EventInput, timeZone: string): Promise<string> {
  const db = forUser(ctx.userId);
  if (input.clientId) {
    const client = await db.client.findFirst({ where: { id: input.clientId, deletedAt: null }, select: { id: true } });
    if (!client) throw validationError("That client no longer exists.", { clientId: ["That client no longer exists."] });
  }
  const startsAt = localDateTimeToUtc(input.date, input.allDay ? "00:00" : (input.startTime ?? "00:00"), timeZone);
  const endsAt = !input.allDay && input.endTime ? localDateTimeToUtc(input.date, input.endTime, timeZone) : null;
  const data = { title: input.title, type: input.type, allDay: input.allDay, startsAt, endsAt, location: input.location, notes: input.notes, clientId: input.clientId };

  if (input.id) {
    const { count } = await db.calendarEvent.updateMany({ where: { id: input.id, deletedAt: null }, data });
    if (count === 0) throw notFound("Event");
    return input.id;
  }
  return (await db.calendarEvent.create({ data: { userId: ctx.userId, ...data } })).id;
}

export async function deleteEvent(ctx: Ctx, id: string): Promise<void> {
  const { count } = await forUser(ctx.userId).calendarEvent.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
  if (count === 0) throw notFound("Event");
}

/**
 * Everything dated inside [from, to] (inclusive calendar days): tasks, events, goal deadlines,
 * milestones — plus a per-day habit summary. Invoices, projects and client deadlines join here in
 * Phase 4. All filtering happens in the database; nothing is loaded outside the window.
 */
export async function getCalendarRange(ctx: Ctx, clock: Clock, from: string, to: string, opts: { habits?: boolean } = {}): Promise<CalendarRange> {
  const db = forUser(ctx.userId);
  const fromDate = parseIsoDate(from);
  const toDate = parseIsoDate(to);
  const startUtc = localDateTimeToUtc(from, "00:00", clock.timeZone);
  const endUtc = localDateTimeToUtc(addDaysIso(to, 1), "00:00", clock.timeZone);

  const [tasks, events, goals, milestones, invoices, projects] = await Promise.all([
    db.task.findMany({
      where: { deletedAt: null, status: { not: "CANCELLED" }, dueDate: { gte: fromDate, lte: toDate } },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      take: TASK_CAP,
      select: { id: true, title: true, dueDate: true, status: true, priority: true },
    }),
    db.calendarEvent.findMany({ where: { deletedAt: null, startsAt: { gte: startUtc, lt: endUtc } }, orderBy: { startsAt: "asc" } }),
    db.goal.findMany({
      where: { deletedAt: null, status: { not: "CANCELLED" }, targetDate: { gte: fromDate, lte: toDate } },
      select: { id: true, name: true, targetDate: true, status: true },
    }),
    db.goalMilestone.findMany({
      where: { dueDate: { gte: fromDate, lte: toDate }, goal: { deletedAt: null, status: { not: "CANCELLED" } } },
      select: { id: true, title: true, dueDate: true, doneAt: true, goal: { select: { id: true, name: true } } },
    }),
    db.invoice.findMany({
      where: { deletedAt: null, dueDate: { gte: fromDate, lte: toDate }, status: { in: ["SENT", "VIEWED", "PARTIALLY_PAID"] } },
      select: { id: true, number: true, dueDate: true, totalMinor: true, amountPaidMinor: true, currency: true, client: { select: { name: true } } },
    }),
    db.project.findMany({
      where: { deletedAt: null, deadline: { gte: fromDate, lte: toDate }, status: { notIn: ["COMPLETED", "CANCELLED"] } },
      select: { id: true, name: true, deadline: true, client: { select: { name: true } } },
    }),
  ]);

  const items: CalendarItem[] = [];
  for (const t of tasks) {
    items.push({
      key: `task:${t.id}`,
      kind: "task",
      date: toIsoDate(t.dueDate!),
      time: null,
      title: t.title,
      subtitle: null,
      done: t.status === "COMPLETED",
      ref: { type: "task", id: t.id },
      tone: t.priority === "URGENT" ? "danger" : t.priority === "HIGH" ? "warning" : "primary",
    });
  }
  for (const e of events) {
    const dto = toEventDTO(e, clock.timeZone);
    items.push({
      key: `event:${e.id}`,
      kind: "event",
      date: dto.date,
      time: dto.startTime,
      title: dto.title,
      subtitle: dto.location,
      done: false,
      ref: { type: "event", id: e.id },
      tone: e.type === "MEETING" ? "info" : e.type === "DEADLINE" ? "danger" : "neutral",
    });
  }
  for (const g of goals) {
    items.push({
      key: `goal:${g.id}`,
      kind: "goal",
      date: toIsoDate(g.targetDate!),
      time: null,
      title: `Goal deadline: ${g.name}`,
      subtitle: null,
      done: g.status === "COMPLETED",
      ref: { type: "goal", id: g.id },
      tone: "success",
    });
  }
  for (const m of milestones) {
    items.push({
      key: `milestone:${m.id}`,
      kind: "milestone",
      date: toIsoDate(m.dueDate!),
      time: null,
      title: m.title,
      subtitle: m.goal.name,
      done: m.doneAt !== null,
      ref: { type: "milestone", id: m.id, parentId: m.goal.id },
      tone: "success",
    });
  }
  for (const inv of invoices) {
    items.push({
      key: `invoice:${inv.id}`,
      kind: "invoice",
      date: toIsoDate(inv.dueDate),
      time: null,
      title: `Invoice due: ${inv.number}`,
      subtitle: inv.client.name,
      done: inv.amountPaidMinor >= inv.totalMinor,
      ref: { type: "invoice", id: inv.id },
      tone: "warning",
    });
  }
  for (const proj of projects) {
    items.push({
      key: `project:${proj.id}`,
      kind: "project",
      date: toIsoDate(proj.deadline!),
      time: null,
      title: `Project deadline: ${proj.name}`,
      subtitle: proj.client.name,
      done: false,
      ref: { type: "project", id: proj.id },
      tone: "danger",
    });
  }

  items.sort((a, b) => (a.date === b.date ? (a.time ?? "00:00").localeCompare(b.time ?? "00:00") : a.date.localeCompare(b.date)));

  const habitDays: Record<string, HabitDaySummary> = {};
  if (opts.habits !== false) {
    const habits = await db.habit.findMany({ where: { archivedAt: null } });
    if (habits.length > 0) {
      const logs = await db.habitLog.findMany({
        where: { habitId: { in: habits.map((h) => h.id) }, date: { gte: fromDate, lte: toDate } },
        select: { habitId: true, date: true },
      });
      const doneBy = new Map<string, Set<string>>();
      for (const l of logs) {
        const day = toIsoDate(l.date);
        (doneBy.get(day) ?? doneBy.set(day, new Set()).get(day)!).add(l.habitId);
      }
      const likes = habits.map((h): [string, HabitLike] => [
        h.id,
        {
          frequency: h.frequency,
          weekdays: h.weekdays,
          targetPerPeriod: h.targetPerPeriod,
          startDate: toIsoDate(h.startDate),
          endDate: h.endDate ? toIsoDate(h.endDate) : null,
        },
      ]);
      for (let day = from; day <= to; day = addDaysIso(day, 1)) {
        let scheduled = 0;
        let done = 0;
        const doneIds = doneBy.get(day) ?? new Set<string>();
        for (const [id, like] of likes) {
          const isScheduled = isScheduledOn(like, day);
          if (isScheduled) scheduled++;
          if (doneIds.has(id)) {
            done++;
            if (!isScheduled) scheduled++; // a flexible habit done that day counts as its own target
          }
        }
        if (scheduled > 0) habitDays[day] = { done, scheduled };
      }
    }
  }

  return { from, to, items, habitDays };
}

/** Dashboard "Upcoming": the next things dated after today, across every module. */
export async function getUpcoming(ctx: Ctx, clock: Clock, days = 14, limit = 8): Promise<CalendarItem[]> {
  const range = await getCalendarRange(ctx, clock, addDaysIso(clock.today, 1), addDaysIso(clock.today, days), { habits: false });
  return range.items.filter((i) => !i.done).slice(0, limit);
}
