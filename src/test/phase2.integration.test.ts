/**
 * Phase 2 integration tests (tasks, habits, goals, notes, calendar) against a real Postgres.
 *   TEST_DATABASE_URL=postgresql://… npm test
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d("phase 2 (real database)", () => {
  let idA = "";
  let idB = "";
  const stamp = Date.now();
  const emails = [`p2a-${stamp}@test.local`, `p2b-${stamp}@test.local`];
  const clock = { timeZone: "Asia/Dhaka", today: "2026-09-21", weekStartsOn: 1 };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let m: any;

  const taskInput = (over: Record<string, unknown> = {}) => ({
    title: "Write proposal",
    description: null,
    status: "TODO" as const,
    priority: "MEDIUM" as const,
    startDate: null,
    dueDate: "2026-09-21",
    categoryId: null,
    projectId: null,
    tags: [] as string[],
    repeat: "NONE" as const,
    repeatInterval: 1,
    repeatUnit: "DAYS" as const,
    notes: null,
    subtasks: [] as { id?: string; title: string; done: boolean }[],
    ...over,
  });

  /** What a browser form actually submits: empty strings instead of null, tags as one comma string. */
  const formRaw = (o: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === null ? "" : k === "tags" && Array.isArray(v) ? v.join(", ") : v]));

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.REGISTRATION_MODE = "open";
    m = {
      prisma: (await import("@/lib/db/client")).prisma,
      auth: await import("@/modules/auth/service"),
      tasks: await import("@/modules/tasks/service"),
      habits: await import("@/modules/habits/service"),
      goals: await import("@/modules/goals/service"),
      notes: await import("@/modules/notes/service"),
      cal: await import("@/modules/calendar/service"),
      settings: await import("@/modules/settings/service"),
      schemas: {
        task: (await import("@/modules/tasks/schema")).taskInputSchema,
        habit: (await import("@/modules/habits/schema")).habitInputSchema,
        goal: (await import("@/modules/goals/schema")).goalInputSchema,
        note: (await import("@/modules/notes/schema")).noteInputSchema,
        event: (await import("@/modules/calendar/schema")).eventInputSchema,
      },
    };
    const reg = (email: string, ip: string) =>
      m.auth.registerUser(
        { name: "T", email, password: "correct horse battery", confirmPassword: "correct horse battery", baseCurrency: "BDT", timezone: "Asia/Dhaka" },
        ip,
      );
    idA = await reg(emails[0] as string, `10.9.${stamp % 250}.1`);
    idB = await reg(emails[1] as string, `10.9.${stamp % 250}.2`);
  });

  afterAll(async () => {
    await m.prisma.user.deleteMany({ where: { email: { in: emails } } });
    await m.prisma.rateLimitBucket.deleteMany({ where: { key: { startsWith: `register:ip:10.9.${stamp % 250}` } } });
  });

  describe("tasks", () => {
    it("validates input server-side", () => {
      const parse = (over: Record<string, unknown>) => m.schemas.task.safeParse(formRaw(taskInput(over)));
      expect(parse({}).success).toBe(true); // the baseline is valid, so the failures below are for the reason stated
      expect(parse({ title: "  " }).success).toBe(false);
      expect(parse({ startDate: "2026-09-30", dueDate: "2026-09-21" }).success).toBe(false);
      expect(parse({ dueDate: null, repeat: "DAILY" }).success).toBe(false);
      expect(parse({ repeatInterval: 0, repeat: "CUSTOM" }).success).toBe(false);
      expect(parse({ dueDate: "2026-02-30" }).success).toBe(false);
      expect(parse({ tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }).success).toBe(false);
    });

    it("creates a task with tags, category and subtasks, and reads it back", async () => {
      const cats = await m.settings.listCategoriesOfType({ userId: idA }, "TASK");
      const id = await m.tasks.saveTask(
        { userId: idA },
        taskInput({ tags: ["Client", "urgent"], categoryId: cats[0].id, subtasks: [{ title: "Outline", done: false }, { title: "Draft", done: true }] }),
      );
      const t = await m.tasks.getTask({ userId: idA }, id, clock.today);
      expect(t.tags).toEqual(["Client", "urgent"]);
      expect(t.subtasks.map((s: { title: string }) => s.title)).toEqual(["Outline", "Draft"]);
      expect(t.categoryName).toBe(cats[0].name);
      expect(t.overdue).toBe(false);
    });

    it("refuses another user's category or task", async () => {
      const catsB = await m.settings.listCategoriesOfType({ userId: idB }, "TASK");
      await expect(m.tasks.saveTask({ userId: idA }, taskInput({ categoryId: catsB[0].id }))).rejects.toMatchObject({ code: "VALIDATION" });

      const idAtask = await m.tasks.saveTask({ userId: idA }, taskInput({ title: "Private" }));
      await expect(m.tasks.setTaskStatus({ userId: idB }, idAtask, "COMPLETED")).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(m.tasks.deleteTask({ userId: idB }, idAtask)).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(await m.tasks.getTask({ userId: idB }, idAtask, clock.today)).toBeNull();
      await expect(m.tasks.saveTask({ userId: idB }, taskInput({ id: idAtask, title: "hijack" }))).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("filters into today / upcoming / overdue / completed views", async () => {
      const u = { userId: idB };
      await m.tasks.saveTask(u, taskInput({ title: "T-today", dueDate: "2026-09-21" }));
      await m.tasks.saveTask(u, taskInput({ title: "T-upcoming", dueDate: "2026-09-25" }));
      await m.tasks.saveTask(u, taskInput({ title: "T-overdue", dueDate: "2026-09-10", priority: "URGENT" }));
      const doneId = await m.tasks.saveTask(u, taskInput({ title: "T-done", dueDate: "2026-09-12" }));
      await m.tasks.setTaskStatus(u, doneId, "COMPLETED");
      await m.tasks.saveTask(u, taskInput({ title: "T-nodate", dueDate: null }));

      const q = (view: string, extra = {}) => ({ view, page: 1, ...extra });
      const titles = async (view: string, extra = {}) => (await m.tasks.listTasks(u, q(view, extra), clock.today)).items.map((t: { title: string }) => t.title);

      expect(await titles("today")).toEqual(["T-today"]);
      expect(await titles("upcoming")).toEqual(["T-upcoming"]);
      expect(await titles("overdue")).toEqual(["T-overdue"]);
      expect(await titles("completed")).toEqual(["T-done"]);
      expect((await titles("all")).length).toBe(5);
      expect(await titles("all", { q: "nodate" })).toEqual(["T-nodate"]);
      expect(await titles("all", { priority: "URGENT" })).toEqual(["T-overdue"]);

      const counts = (await m.tasks.listTasks(u, q("all"), clock.today)).counts;
      expect(counts).toEqual({ today: 1, upcoming: 1, overdue: 1, completed: 1 });
      const overdue = (await m.tasks.listTasks(u, q("overdue"), clock.today)).items[0];
      expect(overdue.overdue).toBe(true);
    });

    it("sorts by due date with no-date tasks last, and by priority", async () => {
      const u = { userId: idB };
      const list = async (sort: string) => (await m.tasks.listTasks(u, { view: "all", page: 1, sort }, clock.today)).items.map((t: { title: string }) => t.title);
      const byDue = await list("due");
      expect(byDue[0]).toBe("T-overdue");
      expect(byDue[byDue.length - 1]).toBe("T-nodate");
      expect((await list("priority"))[0]).toBe("T-overdue");
      expect((await list("title"))[0]).toBe("T-done");
    });

    it("spawns exactly one next occurrence when a repeating task is completed (even if toggled again)", async () => {
      const u = { userId: idA };
      const id = await m.tasks.saveTask(u, taskInput({ title: "Weekly report", dueDate: "2026-09-21", repeat: "WEEKLY", subtasks: [{ title: "Numbers", done: true }], tags: ["ops"] }));
      await m.tasks.setTaskStatus(u, id, "COMPLETED");
      await m.tasks.setTaskStatus(u, id, "TODO");
      await m.tasks.setTaskStatus(u, id, "COMPLETED");
      const all = (await m.tasks.listTasks(u, { view: "all", page: 1, q: "Weekly report" }, clock.today)).items;
      expect(all.length).toBe(2);
      const next = all.find((t: { status: string }) => t.status === "TODO");
      expect(next.dueDate).toBe("2026-09-28");
      expect(next.recurrence).toEqual({ freq: "WEEKLY", interval: 1 });
      expect(next.tags).toEqual(["ops"]);
      expect(next.subtasks).toEqual([expect.objectContaining({ title: "Numbers", done: false })]);
      // completing the copy continues the chain
      await m.tasks.setTaskStatus(u, next.id, "COMPLETED");
      const after = (await m.tasks.listTasks(u, { view: "all", page: 1, q: "Weekly report" }, clock.today)).items;
      expect(after.map((t: { dueDate: string }) => t.dueDate).sort()).toEqual(["2026-09-21", "2026-09-28", "2026-10-05"]);
    });

    it("updates subtasks in place, removes dropped ones, and soft-deletes", async () => {
      const u = { userId: idA };
      const id = await m.tasks.saveTask(u, taskInput({ title: "Subtasks", subtasks: [{ title: "a", done: false }, { title: "b", done: false }] }));
      const t1 = await m.tasks.getTask(u, id, clock.today);
      await m.tasks.saveTask(u, taskInput({ id, title: "Subtasks", subtasks: [{ id: t1.subtasks[1].id, title: "b2", done: true }, { title: "c", done: false }] }));
      const t2 = await m.tasks.getTask(u, id, clock.today);
      expect(t2.subtasks.map((s: { title: string; done: boolean }) => [s.title, s.done])).toEqual([["b2", true], ["c", false]]);
      await m.tasks.toggleSubtask(u, id, t2.subtasks[1].id, true);
      expect((await m.tasks.getTask(u, id, clock.today)).subtasks[1].done).toBe(true);
      await m.tasks.deleteTask(u, id);
      expect(await m.tasks.getTask(u, id, clock.today)).toBeNull();
    });

    it("paginates server-side", async () => {
      const u = { userId: idA };
      for (let i = 0; i < 23; i++) await m.tasks.saveTask(u, taskInput({ title: `Bulk ${String(i).padStart(2, "0")}`, dueDate: null }));
      const p1 = await m.tasks.listTasks(u, { view: "all", page: 1, q: "Bulk", sort: "title" }, clock.today);
      const p2 = await m.tasks.listTasks(u, { view: "all", page: 2, q: "Bulk", sort: "title" }, clock.today);
      expect(p1.total).toBe(23);
      expect(p1.items.length).toBe(20);
      expect(p2.items.length).toBe(3);
    });

    it("dashboard snapshot and upcoming list", async () => {
      const snap = await m.tasks.getTodaySnapshot({ userId: idB }, clock.today);
      expect(snap.overdue.map((t: { title: string }) => t.title)).toEqual(["T-overdue"]);
      expect(snap.today.map((t: { title: string }) => t.title)).toEqual(["T-today"]);
      const up = await m.tasks.getUpcomingTasks({ userId: idB }, clock.today, 7, 5);
      expect(up.map((t: { title: string }) => t.title)).toEqual(["T-upcoming"]);
    });
  });

  describe("habits", () => {
    const habitInput = (over: Record<string, unknown> = {}) => ({
      name: "Read",
      description: null,
      frequency: "DAILY" as const,
      weekdays: [] as number[],
      targetPerPeriod: 1,
      startDate: "2026-09-10",
      endDate: null,
      reminderTime: null,
      categoryId: null,
      color: "#0e6b5c",
      icon: "book" as const,
      ...over,
    });

    it("seeds habit categories on first use for accounts that predate them", async () => {
      const cats = await m.settings.listCategoriesOfType({ userId: idA }, "HABIT");
      expect(cats.map((c: { name: string }) => c.name)).toContain("Health");
    });

    it("validates frequency rules", () => {
      const parse = (over: Record<string, unknown>) => m.schemas.habit.safeParse(formRaw(habitInput(over)));
      expect(parse({}).success).toBe(true);
      expect(parse({ frequency: "WEEKDAYS", weekdays: [] }).success).toBe(false);
      expect(parse({ frequency: "WEEKDAYS", weekdays: [1, 3] }).success).toBe(true);
      expect(parse({ frequency: "WEEKLY", targetPerPeriod: 9 }).success).toBe(false);
      expect(parse({ endDate: "2026-09-01" }).success).toBe(false);
      expect(parse({ color: "green" }).success).toBe(false);
    });

    it("toggles a day on and off, tracks streaks, and rejects the future", async () => {
      const u = { userId: idA };
      const id = await m.habits.saveHabit(u, habitInput());
      for (const day of ["2026-09-19", "2026-09-20", "2026-09-21"]) expect((await m.habits.toggleHabitLog(u, id, day, clock)).done).toBe(true);
      const h = await m.habits.getHabit(u, id, clock);
      expect(h.stats.currentStreak).toBe(3);
      expect(h.stats.doneToday).toBe(true);
      expect(h.dueToday).toBe(true);

      expect((await m.habits.toggleHabitLog(u, id, "2026-09-20", clock)).done).toBe(false);
      expect((await m.habits.getHabit(u, id, clock)).stats.currentStreak).toBe(1);

      await expect(m.habits.toggleHabitLog(u, id, "2026-09-22", clock)).rejects.toMatchObject({ code: "VALIDATION" });
      await expect(m.habits.toggleHabitLog(u, id, "2026-09-01", clock)).rejects.toMatchObject({ code: "VALIDATION" });

      const cached = await m.prisma.habit.findUnique({ where: { id } });
      expect(cached.currentStreak).toBe(1);
      expect(cached.longestStreak).toBe(3);
    });

    it("builds calendar history for a month", async () => {
      const u = { userId: idA };
      const [habit] = (await m.habits.listHabits(u, clock)).filter((h: { name: string }) => h.name === "Read");
      const month = await m.habits.getHabitMonth(u, habit.id, "2026-09", clock);
      expect(month.days.length).toBe(30);
      expect(month.days.find((x: { date: string }) => x.date === "2026-09-21").done).toBe(true);
      expect(month.days.find((x: { date: string }) => x.date === "2026-09-05").beforeStart).toBe(true);
      expect(month.days.find((x: { date: string }) => x.date === "2026-09-25").future).toBe(true);
      expect(month.firstWeekday).toBe(2); // 1 Sep 2026 is a Tuesday
    });

    it("keeps habits private to their owner", async () => {
      const [habit] = await m.habits.listHabits({ userId: idA }, clock);
      expect(await m.habits.getHabit({ userId: idB }, habit.id, clock)).toBeNull();
      await expect(m.habits.toggleHabitLog({ userId: idB }, habit.id, "2026-09-21", clock)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(m.habits.deleteHabit({ userId: idB }, habit.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(m.habits.saveHabit({ userId: idB }, habitInput({ id: habit.id }))).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("archives, lists today's checklist, and deletes with history", async () => {
      const u = { userId: idA };
      const id = await m.habits.saveHabit(u, habitInput({ name: "Stretch", frequency: "WEEKDAYS", weekdays: [1, 3, 5] }));
      expect((await m.habits.getTodayHabits(u, clock)).map((h: { name: string }) => h.name)).toContain("Stretch"); // Monday
      await m.habits.setHabitArchived(u, id, true);
      expect((await m.habits.getTodayHabits(u, clock)).map((h: { name: string }) => h.name)).not.toContain("Stretch");
      await m.habits.deleteHabit(u, id);
      expect(await m.habits.getHabit(u, id, clock)).toBeNull();
    });
  });

  describe("goals", () => {
    const goalInput = (over: Record<string, unknown> = {}) => ({
      name: "Grow my freelance business",
      description: null,
      categoryId: null,
      startDate: "2026-09-01",
      targetDate: "2026-12-31",
      status: "NOT_STARTED" as const,
      progressMode: "FROM_MILESTONES" as const,
      progress: 0,
      notes: null,
      milestones: [
        { title: "Create portfolio", dueDate: null, done: false },
        { title: "Get 5 new clients", dueDate: "2026-10-31", done: false },
        { title: "Publish 20 articles", dueDate: null, done: false },
        { title: "Reach $5,000 monthly revenue", dueDate: null, done: false },
      ],
      ...over,
    });

    it("computes progress from milestones and starts the goal when one is completed", async () => {
      const u = { userId: idA };
      const id = await m.goals.saveGoal(u, goalInput());
      let g = await m.goals.getGoal(u, id, clock.today);
      expect(g.progress).toBe(0);
      expect(g.milestones.length).toBe(4);
      expect(g.daysLeft).toBe(101);

      await m.goals.setMilestoneDone(u, id, g.milestones[0].id, true);
      g = await m.goals.getGoal(u, id, clock.today);
      expect(g.progress).toBe(25);
      expect(g.status).toBe("IN_PROGRESS");

      await m.goals.addMilestone(u, id, "Launch newsletter", null);
      g = await m.goals.getGoal(u, id, clock.today);
      expect(g.milestones.length).toBe(5);
      expect(g.progress).toBe(20);

      await m.goals.deleteMilestone(u, id, g.milestones[4].id);
      expect((await m.goals.getGoal(u, id, clock.today)).progress).toBe(25);
    });

    it("supports manual progress and preserves milestone completion on edit", async () => {
      const u = { userId: idA };
      const id = await m.goals.saveGoal(u, goalInput({ name: "Manual", progressMode: "MANUAL", progress: 65, milestones: [] }));
      expect((await m.goals.getGoal(u, id, clock.today)).progress).toBe(65);

      const id2 = await m.goals.saveGoal(u, goalInput({ name: "Edit me", milestones: [{ title: "A", dueDate: null, done: true }, { title: "B", dueDate: null, done: false }] }));
      const before = await m.goals.getGoal(u, id2, clock.today);
      await m.goals.saveGoal(u, goalInput({ id: id2, name: "Edited", milestones: before.milestones.map((x: { id: string; title: string; done: boolean }) => ({ ...x, dueDate: null })) }));
      const after = await m.goals.getGoal(u, id2, clock.today);
      expect(after.name).toBe("Edited");
      expect(after.progress).toBe(50);
    });

    it("flags overdue goals and stays private", async () => {
      const u = { userId: idA };
      const id = await m.goals.saveGoal(u, goalInput({ name: "Late", targetDate: "2026-09-01", status: "IN_PROGRESS", milestones: [] }));
      expect((await m.goals.getGoal(u, id, clock.today)).overdue).toBe(true);
      expect(await m.goals.getGoal({ userId: idB }, id, clock.today)).toBeNull();
      await expect(m.goals.setMilestoneDone({ userId: idB }, id, "x", true)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(m.goals.deleteGoal({ userId: idB }, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await m.goals.deleteGoal(u, id);
      expect(await m.goals.getGoal(u, id, clock.today)).toBeNull();
    });
  });

  describe("notes", () => {
    const noteInput = (over: Record<string, unknown> = {}) => ({ title: "Meeting notes", content: "Discuss the homepage redesign timeline.", categoryId: null, goalId: null, tags: [] as string[], pinned: false, ...over });

    it("saves, searches by text and tag, pins and filters", async () => {
      const u = { userId: idA };
      const a = await m.notes.saveNote(u, noteInput({ tags: ["design", "client"] }));
      const b = await m.notes.saveNote(u, noteInput({ title: "Reading list", content: "Books about pricing", tags: ["research"] }));
      const list = (query = {}) => m.notes.listNotes(u, { page: 1, ...query });
      expect((await list({ q: "homepage" })).items.map((n: { id: string }) => n.id)).toEqual([a]);
      expect((await list({ q: "pricing" })).items.map((n: { id: string }) => n.id)).toEqual([b]);
      expect((await list({ tag: "Design" })).items.map((n: { id: string }) => n.id)).toEqual([a]);
      expect((await list({ q: "research" })).items.map((n: { id: string }) => n.id)).toEqual([b]);
      expect((await list()).allTags).toEqual(["Client", "design", "research"]); // "client" reuses the tag first created as "Client"

      await m.notes.setNotePinned(u, b, true);
      expect((await list()).items[0].id).toBe(b);
    });

    it("refuses a goal or category that isn't yours, and hides deleted notes", async () => {
      const goalB = await m.goals.saveGoal({ userId: idB }, { name: "B goal", description: null, categoryId: null, startDate: null, targetDate: null, status: "NOT_STARTED", progressMode: "MANUAL", progress: 0, notes: null, milestones: [] });
      await expect(m.notes.saveNote({ userId: idA }, noteInput({ goalId: goalB }))).rejects.toMatchObject({ code: "VALIDATION" });
      const catsB = await m.settings.listCategoriesOfType({ userId: idB }, "NOTE");
      await expect(m.notes.saveNote({ userId: idA }, noteInput({ categoryId: catsB[0].id }))).rejects.toMatchObject({ code: "VALIDATION" });

      const id = await m.notes.saveNote({ userId: idA }, noteInput({ title: "Temp" }));
      await expect(m.notes.deleteNote({ userId: idB }, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await m.notes.deleteNote({ userId: idA }, id);
      expect(await m.notes.getNote({ userId: idA }, id)).toBeNull();
    });
  });

  describe("calendar", () => {
    const evt = (over: Record<string, unknown> = {}) => ({ title: "Client call", type: "MEETING" as const, allDay: false, date: "2026-09-23", clientId: null, startTime: "22:30", endTime: "23:15", location: "Zoom", notes: null, ...over });

    it("stores events at the right instant for the user's time zone and reads them back unchanged", async () => {
      const u = { userId: idA };
      const id = await m.cal.saveEvent(u, evt(), clock.timeZone);
      const row = await m.prisma.calendarEvent.findUnique({ where: { id } });
      expect(row.startsAt.toISOString()).toBe("2026-09-23T16:30:00.000Z"); // 22:30 Dhaka = 16:30 UTC
      const dto = await m.cal.getEvent(u, id, clock.timeZone);
      expect(dto).toMatchObject({ date: "2026-09-23", startTime: "22:30", endTime: "23:15", allDay: false });

      const allDay = await m.cal.saveEvent(u, evt({ title: "Holiday", type: "PERSONAL", allDay: true, startTime: "", endTime: "" }), clock.timeZone);
      expect(await m.cal.getEvent(u, allDay, clock.timeZone)).toMatchObject({ date: "2026-09-23", startTime: null, allDay: true });
    });

    it("validates times", () => {
      const parse = (over: Record<string, unknown>) => m.schemas.event.safeParse(formRaw(evt(over)));
      expect(parse({}).success).toBe(true);
      expect(parse({ startTime: "" }).success).toBe(false);
      expect(parse({ startTime: "10:00", endTime: "09:00" }).success).toBe(false);
      expect(parse({ startTime: "25:00" }).success).toBe(false);
      expect(parse({ allDay: true, startTime: "", endTime: "" }).success).toBe(true);
    });

    it("merges tasks, events, goal deadlines, milestones and habit summaries for a date range", async () => {
      const u = { userId: idA };
      await m.tasks.saveTask(u, taskInput({ title: "Cal task", dueDate: "2026-09-24" }));
      await m.goals.saveGoal(u, { name: "Cal goal", description: null, categoryId: null, startDate: null, targetDate: "2026-09-26", status: "IN_PROGRESS", progressMode: "FROM_MILESTONES", progress: 0, notes: null, milestones: [{ title: "Cal milestone", dueDate: "2026-09-25", done: false }] });
      const range = await m.cal.getCalendarRange(u, clock, "2026-09-21", "2026-09-27");
      const byKind = (k: string) => range.items.filter((i: { kind: string }) => i.kind === k).map((i: { title: string }) => i.title);
      expect(byKind("task")).toContain("Cal task");
      expect(byKind("event")).toContain("Client call");
      expect(byKind("goal")).toContain("Goal deadline: Cal goal");
      expect(byKind("milestone")).toEqual(["Cal milestone"]);
      expect(range.habitDays["2026-09-21"]).toEqual({ done: 1, scheduled: 1 }); // "Read" done today
      const dates = range.items.map((i: { date: string }) => i.date);
      expect([...dates].sort()).toEqual(dates);

      const outside = await m.cal.getCalendarRange(u, clock, "2026-11-01", "2026-11-30");
      expect(outside.items).toEqual([]);

      const upcoming = await m.cal.getUpcoming(u, clock, 14, 20);
      expect(upcoming.every((i: { date: string }) => i.date > clock.today)).toBe(true);
      expect(upcoming.length).toBeGreaterThanOrEqual(4);
    });

    it("never shows another user's items, and deletes only your own events", async () => {
      const range = await m.cal.getCalendarRange({ userId: idB }, clock, "2026-09-21", "2026-09-27");
      expect(range.items.map((i: { title: string }) => i.title)).not.toContain("Client call");
      const [mine] = (await m.cal.getCalendarRange({ userId: idA }, clock, "2026-09-23", "2026-09-23")).items.filter((i: { kind: string }) => i.kind === "event");
      await expect(m.cal.deleteEvent({ userId: idB }, mine.ref.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await m.cal.deleteEvent({ userId: idA }, mine.ref.id);
      expect(await m.cal.getEvent({ userId: idA }, mine.ref.id, clock.timeZone)).toBeNull();
    });
  });
});
