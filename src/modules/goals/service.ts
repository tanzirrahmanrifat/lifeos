import type { Prisma } from "@/generated/prisma/client";
import type { GoalStatus } from "@/generated/prisma/enums";
import type { Ctx } from "@/lib/auth/require-user";
import { daysBetweenIso, parseIsoDate, toIsoDateOrNull } from "@/lib/dates";
import { forUser } from "@/lib/db/tenant";
import { notFound } from "@/lib/errors";
import { assertOwnedCategory } from "@/modules/shared/categories";
import { computeGoalProgress } from "./progress";
import type { GoalInput } from "./schema";
import type { GoalDTO } from "./types";

const goalInclude = {
  category: { select: { name: true, color: true } },
  milestones: { orderBy: { position: "asc" as const } },
} satisfies Prisma.GoalInclude;
type GoalRow = Prisma.GoalGetPayload<{ include: typeof goalInclude }>;

const CLOSED: GoalStatus[] = ["COMPLETED", "CANCELLED"];

function toDTO(g: GoalRow, today: string): GoalDTO {
  const targetDate = toIsoDateOrNull(g.targetDate);
  const milestones = g.milestones.map((m) => ({ id: m.id, title: m.title, dueDate: toIsoDateOrNull(m.dueDate), done: m.doneAt !== null }));
  const open = !CLOSED.includes(g.status);
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    categoryId: g.categoryId,
    categoryName: g.category?.name ?? null,
    categoryColor: g.category?.color ?? null,
    startDate: toIsoDateOrNull(g.startDate),
    targetDate,
    status: g.status,
    progressMode: g.progressMode,
    progress: computeGoalProgress(g.progressMode, g.progress, milestones),
    notes: g.notes,
    milestones,
    overdue: open && targetDate !== null && targetDate < today,
    daysLeft: open && targetDate ? daysBetweenIso(today, targetDate) : null,
  };
}

export async function listGoals(ctx: Ctx, today: string, status?: GoalStatus): Promise<GoalDTO[]> {
  const rows = await forUser(ctx.userId).goal.findMany({
    where: { deletedAt: null, ...(status ? { status } : {}) },
    orderBy: [{ targetDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    include: goalInclude,
  });
  return rows.map((r) => toDTO(r, today));
}

export async function getGoal(ctx: Ctx, id: string, today: string): Promise<GoalDTO | null> {
  const row = await forUser(ctx.userId).goal.findFirst({ where: { id, deletedAt: null }, include: goalInclude });
  return row ? toDTO(row, today) : null;
}

export async function saveGoal(ctx: Ctx, input: GoalInput): Promise<string> {
  const db = forUser(ctx.userId);
  await assertOwnedCategory(db, input.categoryId, "GOAL");
  const progress = computeGoalProgress(input.progressMode, input.progress, input.milestones);

  return db.$transaction(async (tx) => {
    const fields = {
      name: input.name,
      description: input.description,
      categoryId: input.categoryId,
      startDate: input.startDate ? parseIsoDate(input.startDate) : null,
      targetDate: input.targetDate ? parseIsoDate(input.targetDate) : null,
      status: input.status,
      progressMode: input.progressMode,
      progress,
      notes: input.notes,
    };
    let id: string;
    if (input.id) {
      const existing = await tx.goal.findFirst({ where: { id: input.id, deletedAt: null }, select: { id: true } });
      if (!existing) throw notFound("Goal");
      id = existing.id;
      await tx.goal.update({ where: { id }, data: fields });
    } else {
      id = (await tx.goal.create({ data: { userId: ctx.userId, ...fields } })).id;
    }

    const current = await tx.goalMilestone.findMany({ where: { goalId: id }, select: { id: true, doneAt: true } });
    const known = new Map(current.map((m) => [m.id, m.doneAt]));
    const keep = new Set(input.milestones.filter((m) => m.id && known.has(m.id)).map((m) => m.id as string));
    const removed = current.filter((m) => !keep.has(m.id)).map((m) => m.id);
    if (removed.length > 0) await tx.goalMilestone.deleteMany({ where: { goalId: id, id: { in: removed } } });

    for (const [position, m] of input.milestones.entries()) {
      const dueDate = m.dueDate ? parseIsoDate(m.dueDate) : null;
      if (m.id && keep.has(m.id)) {
        const wasDone = known.get(m.id) ?? null;
        await tx.goalMilestone.update({
          where: { id: m.id },
          data: { title: m.title, dueDate, position, doneAt: m.done ? (wasDone ?? new Date()) : null },
        });
      } else {
        await tx.goalMilestone.create({ data: { goalId: id, title: m.title, dueDate, position, doneAt: m.done ? new Date() : null } });
      }
    }
    return id;
  });
}

/** Recomputes the cached progress after a milestone changes; starts a goal that hasn't begun. */
async function refreshFromMilestones(ctx: Ctx, goalId: string): Promise<void> {
  const db = forUser(ctx.userId);
  const goal = await db.goal.findFirst({ where: { id: goalId, deletedAt: null }, include: goalInclude });
  if (!goal) throw notFound("Goal");
  const ms = goal.milestones.map((m) => ({ done: m.doneAt !== null }));
  const progress = computeGoalProgress(goal.progressMode, goal.progress, ms);
  const started = goal.status === "NOT_STARTED" && ms.some((m) => m.done);
  await db.goal.updateMany({ where: { id: goalId }, data: { progress, ...(started ? { status: "IN_PROGRESS" as const } : {}) } });
}

export async function setMilestoneDone(ctx: Ctx, goalId: string, milestoneId: string, done: boolean): Promise<void> {
  const db = forUser(ctx.userId);
  const goal = await db.goal.findFirst({ where: { id: goalId, deletedAt: null }, select: { id: true } });
  if (!goal) throw notFound("Goal");
  const { count } = await db.goalMilestone.updateMany({ where: { id: milestoneId, goalId }, data: { doneAt: done ? new Date() : null } });
  if (count === 0) throw notFound("Milestone");
  await refreshFromMilestones(ctx, goalId);
}

export async function addMilestone(ctx: Ctx, goalId: string, title: string, dueDate: string | null): Promise<void> {
  const db = forUser(ctx.userId);
  const goal = await db.goal.findFirst({ where: { id: goalId, deletedAt: null }, select: { id: true } });
  if (!goal) throw notFound("Goal");
  const position = await db.goalMilestone.count({ where: { goalId } });
  await db.goalMilestone.create({ data: { goalId, title, dueDate: dueDate ? parseIsoDate(dueDate) : null, position } });
  await refreshFromMilestones(ctx, goalId);
}

export async function deleteMilestone(ctx: Ctx, goalId: string, milestoneId: string): Promise<void> {
  const db = forUser(ctx.userId);
  const goal = await db.goal.findFirst({ where: { id: goalId, deletedAt: null }, select: { id: true } });
  if (!goal) throw notFound("Goal");
  await db.goalMilestone.deleteMany({ where: { id: milestoneId, goalId } });
  await refreshFromMilestones(ctx, goalId);
}

export async function setGoalStatus(ctx: Ctx, id: string, status: GoalStatus): Promise<void> {
  const { count } = await forUser(ctx.userId).goal.updateMany({ where: { id, deletedAt: null }, data: { status } });
  if (count === 0) throw notFound("Goal");
}

export async function deleteGoal(ctx: Ctx, id: string): Promise<void> {
  const { count } = await forUser(ctx.userId).goal.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
  if (count === 0) throw notFound("Goal");
}
