import { Prisma } from "@/generated/prisma/client";
import type { Priority, TaskStatus } from "@/generated/prisma/enums";
import type { Ctx } from "@/lib/auth/require-user";
import { addDaysIso, daysBetweenIso, parseIsoDate, toIsoDateOrNull } from "@/lib/dates";
import { forUser, type ScopedDb } from "@/lib/db/tenant";
import { notFound } from "@/lib/errors";
import { assertOwnedCategory } from "@/modules/shared/categories";
import { resolveTagIds } from "@/modules/shared/tags";
import { nextOccurrence, parseRecurrence, ruleFromForm, type Recurrence } from "./recurrence";
import type { TaskInput, TaskListQuery } from "./schema";
import type { TaskDTO, TaskListResult } from "./types";

export const TASK_PAGE_SIZE = 20;
const OPEN: TaskStatus[] = ["TODO", "IN_PROGRESS"];

const taskInclude = {
  category: { select: { name: true, color: true } },
  tags: { select: { tag: { select: { name: true } } } },
  subtasks: { orderBy: { position: "asc" as const }, select: { id: true, title: true, done: true } },
} satisfies Prisma.TaskInclude;

type TaskRow = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

export function toTaskDTO(t: TaskRow, today: string): TaskDTO {
  const dueDate = toIsoDateOrNull(t.dueDate);
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    startDate: toIsoDateOrNull(t.startDate),
    dueDate,
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    categoryId: t.categoryId,
    categoryName: t.category?.name ?? null,
    categoryColor: t.category?.color ?? null,
    tags: t.tags.map((x) => x.tag.name).sort((a, b) => a.localeCompare(b)),
    notes: t.notes,
    recurrence: parseRecurrence(t.recurrenceRule),
    subtasks: t.subtasks,
    overdue: dueDate !== null && dueDate < today && OPEN.includes(t.status),
  };
}

// ───────────────────────────── Reads ─────────────────────────────

function viewFilter(view: TaskListQuery["view"], today: string): Prisma.TaskWhereInput {
  const day = parseIsoDate(today);
  switch (view) {
    case "today":
      return { dueDate: day, status: { not: "CANCELLED" } };
    case "upcoming":
      return { dueDate: { gt: day }, status: { in: OPEN } };
    case "overdue":
      return { dueDate: { lt: day }, status: { in: OPEN } };
    case "completed":
      return { status: "COMPLETED" };
    case "all":
      return {};
  }
}

function orderFor(query: TaskListQuery): Prisma.TaskOrderByWithRelationInput[] {
  const sort = query.sort ?? (query.view === "completed" ? "created" : "due");
  switch (sort) {
    case "priority":
      return [{ priority: "desc" }, { dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }];
    case "created":
      return query.view === "completed" ? [{ completedAt: "desc" }, { createdAt: "desc" }] : [{ createdAt: "desc" }];
    case "title":
      return [{ title: "asc" }];
    case "due":
      return [{ dueDate: { sort: "asc", nulls: "last" } }, { priority: "desc" }, { createdAt: "desc" }];
  }
}

export async function listTasks(ctx: Ctx, query: TaskListQuery, today: string): Promise<TaskListResult> {
  const db = forUser(ctx.userId);
  const where: Prisma.TaskWhereInput = {
    AND: [
      { deletedAt: null },
      viewFilter(query.view, today),
      query.status ? { status: query.status } : {},
      query.priority ? { priority: query.priority } : {},
      query.categoryId ? { categoryId: query.categoryId } : {},
      query.q ? { OR: [{ title: { contains: query.q, mode: "insensitive" } }, { description: { contains: query.q, mode: "insensitive" } }] } : {},
    ],
  };

  const day = parseIsoDate(today);
  const base = { deletedAt: null };
  const [total, rows, todayN, upcomingN, overdueN, completedN] = await Promise.all([
    db.task.count({ where }),
    db.task.findMany({
      where,
      orderBy: orderFor(query),
      skip: (query.page - 1) * TASK_PAGE_SIZE,
      take: TASK_PAGE_SIZE,
      include: taskInclude,
    }),
    db.task.count({ where: { ...base, dueDate: day, status: { not: "CANCELLED" } } }),
    db.task.count({ where: { ...base, dueDate: { gt: day }, status: { in: OPEN } } }),
    db.task.count({ where: { ...base, dueDate: { lt: day }, status: { in: OPEN } } }),
    db.task.count({ where: { ...base, status: "COMPLETED" } }),
  ]);

  return {
    items: rows.map((r) => toTaskDTO(r, today)),
    total,
    page: query.page,
    pageSize: TASK_PAGE_SIZE,
    counts: { today: todayN, upcoming: upcomingN, overdue: overdueN, completed: completedN },
  };
}

export async function getTask(ctx: Ctx, id: string, today: string): Promise<TaskDTO | null> {
  const row = await forUser(ctx.userId).task.findFirst({ where: { id, deletedAt: null }, include: taskInclude });
  return row ? toTaskDTO(row, today) : null;
}

/** Dashboard: what needs attention today. */
export async function getTodaySnapshot(ctx: Ctx, today: string) {
  const db = forUser(ctx.userId);
  const day = parseIsoDate(today);
  const base = { deletedAt: null };
  const [overdue, dueToday, completedToday, overdueCount] = await Promise.all([
    db.task.findMany({
      where: { ...base, dueDate: { lt: day }, status: { in: OPEN } },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      take: 5,
      include: taskInclude,
    }),
    db.task.findMany({
      where: { ...base, dueDate: day, status: { not: "CANCELLED" } },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "asc" }],
      take: 15,
      include: taskInclude,
    }),
    db.task.count({ where: { ...base, status: "COMPLETED", dueDate: day } }),
    db.task.count({ where: { ...base, dueDate: { lt: day }, status: { in: OPEN } } }),
  ]);
  return {
    overdue: overdue.map((t) => toTaskDTO(t, today)),
    overdueCount,
    today: dueToday.map((t) => toTaskDTO(t, today)),
    completedToday,
  };
}

/** Upcoming open tasks in the next `days` days (excluding today). */
export async function getUpcomingTasks(ctx: Ctx, today: string, days: number, take: number) {
  const rows = await forUser(ctx.userId).task.findMany({
    where: {
      deletedAt: null,
      status: { in: OPEN },
      dueDate: { gt: parseIsoDate(today), lte: parseIsoDate(addDaysIso(today, days)) },
    },
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
    take,
    select: { id: true, title: true, dueDate: true, priority: true },
  });
  return rows.map((r) => ({ id: r.id, title: r.title, dueDate: toIsoDateOrNull(r.dueDate)!, priority: r.priority as Priority }));
}

// ───────────────────────────── Writes ─────────────────────────────

type Db = ScopedDb;
type Tx = Omit<Db, "$transaction" | "$connect" | "$disconnect" | "$on" | "$extends">;

/**
 * When a repeating task is completed, create the next occurrence (due date counted from the old due
 * date). Guarded so completing/reopening/completing again never spawns duplicates.
 */
async function spawnNextOccurrence(tx: Tx, userId: string, taskId: string): Promise<void> {
  const task = await tx.task.findFirst({
    where: { id: taskId },
    include: { subtasks: { orderBy: { position: "asc" } }, tags: true },
  });
  const rule: Recurrence | null = task ? parseRecurrence(task.recurrenceRule) : null;
  if (!task || !rule || !task.dueDate) return;

  const due = toIsoDateOrNull(task.dueDate)!;
  const nextDue = nextOccurrence(due, rule);
  const rootId = task.recurrenceParentId ?? task.id;
  const already = await tx.task.findFirst({
    where: { recurrenceParentId: rootId, dueDate: parseIsoDate(nextDue), deletedAt: null },
    select: { id: true },
  });
  if (already) return;

  const start = toIsoDateOrNull(task.startDate);
  const created = await tx.task.create({
    data: {
      userId,
      title: task.title,
      description: task.description,
      status: "TODO",
      priority: task.priority,
      dueDate: parseIsoDate(nextDue),
      startDate: start ? parseIsoDate(addDaysIso(start, daysBetweenIso(due, nextDue))) : null,
      categoryId: task.categoryId,
      projectId: task.projectId,
      clientId: task.clientId,
      goalId: task.goalId,
      recurrenceRule: task.recurrenceRule ?? undefined,
      recurrenceParentId: rootId,
      notes: task.notes,
    },
  });
  if (task.subtasks.length > 0) {
    await tx.taskSubtask.createMany({
      data: task.subtasks.map((s, i) => ({ taskId: created.id, title: s.title, done: false, position: i })),
    });
  }
  if (task.tags.length > 0) {
    await tx.taskTag.createMany({ data: task.tags.map((t) => ({ taskId: created.id, tagId: t.tagId })) });
  }
}

/** Create or update a task with its tags and subtasks, atomically. Returns the task id. */
export async function saveTask(ctx: Ctx, input: TaskInput): Promise<string> {
  const db = forUser(ctx.userId);
  await assertOwnedCategory(db, input.categoryId, "TASK");
  if (input.projectId) {
    const project = await db.project.findFirst({ where: { id: input.projectId, deletedAt: null }, select: { id: true } });
    if (!project) throw notFound("Project");
  }
  const tagIds = await resolveTagIds(db, ctx.userId, input.tags);
  const rule = ruleFromForm(input.repeat, input.repeatInterval, input.repeatUnit);

  const fields = {
    title: input.title,
    description: input.description,
    priority: input.priority as Priority,
    startDate: input.startDate ? parseIsoDate(input.startDate) : null,
    dueDate: input.dueDate ? parseIsoDate(input.dueDate) : null,
    categoryId: input.categoryId,
    projectId: input.projectId,
    notes: input.notes,
    recurrenceRule: rule ?? undefined,
  };

  return db.$transaction(async (tx) => {
    let id: string;
    let previousStatus: TaskStatus | null = null;

    if (input.id) {
      const existing = await tx.task.findFirst({ where: { id: input.id, deletedAt: null }, select: { id: true, status: true } });
      if (!existing) throw notFound("Task");
      previousStatus = existing.status;
      id = existing.id;
      await tx.task.update({
        where: { id },
        data: {
          ...fields,
          recurrenceRule: rule ?? Prisma.DbNull, // a plain null is rejected for JSON columns
          status: input.status,
          completedAt: input.status === "COMPLETED" ? (previousStatus === "COMPLETED" ? undefined : new Date()) : null,
        },
      });
    } else {
      const created = await tx.task.create({
        data: { userId: ctx.userId, ...fields, status: input.status, completedAt: input.status === "COMPLETED" ? new Date() : null },
      });
      id = created.id;
    }

    // Tags: replace the set.
    await tx.taskTag.deleteMany({ where: { taskId: id } });
    if (tagIds.length > 0) await tx.taskTag.createMany({ data: tagIds.map((tagId) => ({ taskId: id, tagId })) });

    // Subtasks: update kept ones (only ids that really belong to this task), delete the rest, add new.
    const current = await tx.taskSubtask.findMany({ where: { taskId: id }, select: { id: true } });
    const currentIds = new Set(current.map((s) => s.id));
    const keepIds = new Set(input.subtasks.filter((s) => s.id && currentIds.has(s.id)).map((s) => s.id as string));
    const removed = current.filter((s) => !keepIds.has(s.id)).map((s) => s.id);
    if (removed.length > 0) await tx.taskSubtask.deleteMany({ where: { taskId: id, id: { in: removed } } });
    for (const [position, s] of input.subtasks.entries()) {
      if (s.id && keepIds.has(s.id)) {
        await tx.taskSubtask.update({ where: { id: s.id }, data: { title: s.title, done: s.done, position } });
      } else {
        await tx.taskSubtask.create({ data: { taskId: id, title: s.title, done: s.done, position } });
      }
    }

    if (input.status === "COMPLETED" && previousStatus !== "COMPLETED") await spawnNextOccurrence(tx, ctx.userId, id);
    return id;
  });
}

/** One-click complete / reopen / change status. */
export async function setTaskStatus(ctx: Ctx, id: string, status: TaskStatus): Promise<void> {
  const db = forUser(ctx.userId);
  await db.$transaction(async (tx) => {
    const task = await tx.task.findFirst({ where: { id, deletedAt: null }, select: { id: true, status: true } });
    if (!task) throw notFound("Task");
    if (task.status === status) return;
    await tx.task.update({ where: { id }, data: { status, completedAt: status === "COMPLETED" ? new Date() : null } });
    if (status === "COMPLETED") await spawnNextOccurrence(tx, ctx.userId, id);
  });
}

export async function toggleSubtask(ctx: Ctx, taskId: string, subtaskId: string, done: boolean): Promise<void> {
  const db = forUser(ctx.userId);
  const task = await db.task.findFirst({ where: { id: taskId, deletedAt: null }, select: { id: true } });
  if (!task) throw notFound("Task");
  const { count } = await db.taskSubtask.updateMany({ where: { id: subtaskId, taskId }, data: { done } });
  if (count === 0) throw notFound("Subtask");
}

export async function deleteTask(ctx: Ctx, id: string): Promise<void> {
  const { count } = await forUser(ctx.userId).task.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
  if (count === 0) throw notFound("Task");
}

