import type { Prisma } from "@/generated/prisma/client";
import type { Ctx } from "@/lib/auth/require-user";
import { addDaysIso, daysInMonth, parseIsoDate, toIsoDate, toIsoDateOrNull, weekdayOfIso } from "@/lib/dates";
import { forUser } from "@/lib/db/tenant";
import { notFound, validationError } from "@/lib/errors";
import { assertOwnedCategory } from "@/modules/shared/categories";
import type { Clock } from "@/modules/shared/clock";
import type { HabitInput } from "./schema";
import { computeStats, isDueToday, isScheduledOn, type HabitLike } from "./streaks";
import type { HabitDTO, HabitMonthDTO } from "./types";

const habitInclude = { category: { select: { name: true } } } satisfies Prisma.HabitInclude;
type HabitRow = Prisma.HabitGetPayload<{ include: typeof habitInclude }>;

const asLike = (h: HabitRow): HabitLike => ({
  frequency: h.frequency,
  weekdays: h.weekdays,
  targetPerPeriod: h.targetPerPeriod,
  startDate: toIsoDateOrNull(h.startDate)!,
  endDate: toIsoDateOrNull(h.endDate),
});

function toDTO(h: HabitRow, done: ReadonlySet<string>, clock: Clock): HabitDTO {
  const like = asLike(h);
  return {
    id: h.id,
    name: h.name,
    description: h.description,
    frequency: h.frequency,
    weekdays: h.weekdays,
    targetPerPeriod: h.targetPerPeriod,
    startDate: like.startDate,
    endDate: like.endDate,
    reminderTime: h.reminderTime,
    categoryId: h.categoryId,
    categoryName: h.category?.name ?? null,
    color: h.color ?? "#0e6b5c",
    icon: h.icon ?? "check",
    archived: h.archivedAt !== null,
    stats: computeStats(like, done, clock),
    dueToday: h.archivedAt === null && isDueToday(like, clock.today),
  };
}

async function loadDoneDates(ctx: Ctx, habitIds: string[]): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>(habitIds.map((id) => [id, new Set<string>()]));
  if (habitIds.length === 0) return map;
  const logs = await forUser(ctx.userId).habitLog.findMany({ where: { habitId: { in: habitIds } }, select: { habitId: true, date: true } });
  for (const l of logs) map.get(l.habitId)?.add(toIsoDate(l.date));
  return map;
}

export async function listHabits(ctx: Ctx, clock: Clock, opts: { includeArchived?: boolean } = {}): Promise<HabitDTO[]> {
  const rows = await forUser(ctx.userId).habit.findMany({
    where: opts.includeArchived ? {} : { archivedAt: null },
    orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    include: habitInclude,
  });
  const done = await loadDoneDates(ctx, rows.map((r) => r.id));
  return rows.map((r) => toDTO(r, done.get(r.id) ?? new Set(), clock));
}

export async function getHabit(ctx: Ctx, id: string, clock: Clock): Promise<HabitDTO | null> {
  const row = await forUser(ctx.userId).habit.findFirst({ where: { id }, include: habitInclude });
  if (!row) return null;
  const done = await loadDoneDates(ctx, [row.id]);
  return toDTO(row, done.get(row.id) ?? new Set(), clock);
}

export async function saveHabit(ctx: Ctx, input: HabitInput): Promise<string> {
  const db = forUser(ctx.userId);
  await assertOwnedCategory(db, input.categoryId, "HABIT");
  const data = {
    name: input.name,
    description: input.description,
    frequency: input.frequency,
    weekdays: input.frequency === "WEEKDAYS" ? [...new Set(input.weekdays)].sort() : [],
    targetPerPeriod: input.frequency === "DAILY" || input.frequency === "WEEKDAYS" ? 1 : input.targetPerPeriod,
    startDate: parseIsoDate(input.startDate),
    endDate: input.endDate ? parseIsoDate(input.endDate) : null,
    reminderTime: input.reminderTime,
    categoryId: input.categoryId,
    color: input.color,
    icon: input.icon,
  };
  if (input.id) {
    const { count } = await db.habit.updateMany({ where: { id: input.id }, data });
    if (count === 0) throw notFound("Habit");
    return input.id;
  }
  return (await db.habit.create({ data: { userId: ctx.userId, ...data } })).id;
}

export async function setHabitArchived(ctx: Ctx, id: string, archived: boolean): Promise<void> {
  const { count } = await forUser(ctx.userId).habit.updateMany({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
  if (count === 0) throw notFound("Habit");
}

/** Permanently removes a habit and its history (logs cascade). */
export async function deleteHabit(ctx: Ctx, id: string): Promise<void> {
  const { count } = await forUser(ctx.userId).habit.deleteMany({ where: { id } });
  if (count === 0) throw notFound("Habit");
}

/** One click: mark done / undo for a day. Past days can be back-filled; the future can't. */
export async function toggleHabitLog(ctx: Ctx, habitId: string, date: string, clock: Clock): Promise<{ done: boolean }> {
  if (date > clock.today) throw validationError("You can't check off a day that hasn't happened yet.");
  const db = forUser(ctx.userId);
  const habit = await db.habit.findFirst({ where: { id: habitId }, include: habitInclude });
  if (!habit) throw notFound("Habit");
  if (date < (toIsoDateOrNull(habit.startDate) ?? date)) throw validationError("That day is before this habit started.");

  const day = parseIsoDate(date);
  const existing = await db.habitLog.findFirst({ where: { habitId, date: day }, select: { id: true } });
  let done: boolean;
  if (existing) {
    await db.habitLog.deleteMany({ where: { id: existing.id } });
    done = false;
  } else {
    // The unique (habitId, date) index makes a double-click race harmless.
    await db.habitLog.upsert({
      where: { habitId_date: { habitId, date: day } },
      create: { userId: ctx.userId, habitId, date: day },
      update: {},
    });
    done = true;
  }

  const dates = (await loadDoneDates(ctx, [habitId])).get(habitId) ?? new Set<string>();
  const stats = computeStats(asLike(habit), dates, clock);
  await db.habit.updateMany({
    where: { id: habitId },
    data: { currentStreak: stats.currentStreak, longestStreak: Math.max(habit.longestStreak, stats.longestStreak) },
  });
  return { done };
}

/** Calendar history for one month of one habit. */
export async function getHabitMonth(ctx: Ctx, habitId: string, month: string, clock: Clock): Promise<HabitMonthDTO | null> {
  const habit = await forUser(ctx.userId).habit.findFirst({ where: { id: habitId }, include: habitInclude });
  if (!habit) return null;
  const like = asLike(habit);
  const [y, m] = month.split("-").map(Number) as [number, number];
  const first = `${month}-01`;
  const last = addDaysIso(first, daysInMonth(y, m) - 1);
  const logs = await forUser(ctx.userId).habitLog.findMany({
    where: { habitId, date: { gte: parseIsoDate(first), lte: parseIsoDate(last) } },
    select: { date: true },
  });
  const done = new Set(logs.map((l) => toIsoDate(l.date)));
  const days = Array.from({ length: daysInMonth(y, m) }, (_, i) => {
    const date = addDaysIso(first, i);
    return {
      date,
      scheduled: isScheduledOn(like, date),
      done: done.has(date),
      future: date > clock.today,
      beforeStart: date < like.startDate,
    };
  });
  return { month, days, firstWeekday: weekdayOfIso(first) };
}

/** Dashboard checklist: habits due today with their progress. */
export async function getTodayHabits(ctx: Ctx, clock: Clock): Promise<HabitDTO[]> {
  return (await listHabits(ctx, clock)).filter((h) => h.dueToday);
}
