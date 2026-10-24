import type { Prisma } from "@/generated/prisma/client";
import type { FinancialGoalStatus } from "@/generated/prisma/enums";
import type { Ctx } from "@/lib/auth/require-user";
import { daysBetweenIso, parseIsoDate, toIsoDate } from "@/lib/dates";
import { forUser } from "@/lib/db/tenant";
import { notFound, validationError } from "@/lib/errors";
import { Money } from "@/lib/money";
import { requirePositiveMoney } from "@/modules/finance/money-input";
import { assertOwnedCategory } from "@/modules/shared/categories";
import type { ContributionInput, FinancialGoalInput } from "./schema";
import type { FinancialGoalDTO } from "./types";


const goalInclude = {
  category: { select: { name: true } },
  contributions: { orderBy: { date: "desc" as const }, include: { sourceAccount: { select: { name: true } } } },
} satisfies Prisma.FinancialGoalInclude;
type GoalRow = Prisma.FinancialGoalGetPayload<{ include: typeof goalInclude }>;

function toDTO(g: GoalRow, today: string): FinancialGoalDTO {
  const target = Money.of(g.targetMinor, g.currency);
  const current = Money.of(g.currentMinor, g.currency);
  const remaining = target.sub(current).isNegative() ? Money.zero(g.currency) : target.sub(current);
  const targetDate = g.targetDate ? toIsoDate(g.targetDate) : null;

  let requiredMonthly: Money | null = null;
  if (targetDate && remaining.isPositive() && g.status === "ACTIVE") {
    const days = daysBetweenIso(today, targetDate);
    const months = Math.max(1, days / 30.44);
    requiredMonthly = remaining.mulQuantity((1 / months).toFixed(10));
  }

  return {
    id: g.id,
    name: g.name,
    target: target.toDTO(),
    current: current.toDTO(),
    remaining: remaining.toDTO(),
    progressPct: target.isPositive() ? Math.min(100, Math.round((Number(current.minor) / Number(target.minor)) * 100)) : 0,
    targetDate,
    categoryId: g.categoryId,
    categoryName: g.category?.name ?? null,
    priority: g.priority,
    status: g.status,
    notes: g.notes,
    requiredMonthly: requiredMonthly ? requiredMonthly.toDTO() : null,
    contributions: g.contributions.map((c) => ({
      id: c.id,
      amount: Money.of(c.amountMinor, c.currency).toDTO(),
      date: toIsoDate(c.date),
      sourceAccountId: c.sourceAccountId,
      sourceAccountName: c.sourceAccount?.name ?? null,
      notes: c.notes,
    })),
  };
}

export async function listFinancialGoals(ctx: Ctx, today: string, status?: FinancialGoalStatus): Promise<FinancialGoalDTO[]> {
  const rows = await forUser(ctx.userId).financialGoal.findMany({
    where: { deletedAt: null, ...(status ? { status } : {}) },
    orderBy: [{ status: "asc" }, { targetDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    include: goalInclude,
  });
  return rows.map((r) => toDTO(r, today));
}

export async function getFinancialGoal(ctx: Ctx, id: string, today: string): Promise<FinancialGoalDTO | null> {
  const row = await forUser(ctx.userId).financialGoal.findFirst({ where: { id, deletedAt: null }, include: goalInclude });
  return row ? toDTO(row, today) : null;
}

/** Sum of every active goal's current amount, in `currency` — used for the dashboard. */
export async function getTotalSavingsProgress(ctx: Ctx, currency: string): Promise<Money> {
  const rows = await forUser(ctx.userId).financialGoal.aggregate({ where: { deletedAt: null, status: "ACTIVE", currency }, _sum: { currentMinor: true } });
  return Money.of(rows._sum.currentMinor ?? 0n, currency);
}

export async function saveFinancialGoal(ctx: Ctx, input: FinancialGoalInput, baseCurrency: string): Promise<string> {
  const db = forUser(ctx.userId);
  await assertOwnedCategory(db, input.categoryId, "GOAL");
  const target = requirePositiveMoney(input.targetAmount, baseCurrency, "targetAmount");
  const fields = { name: input.name, targetMinor: target.minor, currency: baseCurrency, targetDate: input.targetDate ? parseIsoDate(input.targetDate) : null, categoryId: input.categoryId, priority: input.priority, status: input.status, notes: input.notes };

  if (input.id) {
    const { count } = await db.financialGoal.updateMany({ where: { id: input.id, deletedAt: null }, data: fields });
    if (count === 0) throw notFound("Financial goal");
    return input.id;
  }
  return (await db.financialGoal.create({ data: { userId: ctx.userId, currentMinor: 0n, ...fields } })).id;
}

export async function deleteFinancialGoal(ctx: Ctx, id: string): Promise<void> {
  const { count } = await forUser(ctx.userId).financialGoal.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
  if (count === 0) throw notFound("Financial goal");
}

/**
 * Adds a contribution. If a source account is given, the money actually moves: the account's
 * balance is decreased (it is really "spent" into the goal), the same way a transfer would.
 * Without a source account, the contribution is a pure earmark — it tracks progress without
 * touching any account.
 */
export async function addContribution(ctx: Ctx, input: ContributionInput): Promise<void> {
  const db = forUser(ctx.userId);
  const goal = await db.financialGoal.findFirst({ where: { id: input.goalId, deletedAt: null } });
  if (!goal) throw notFound("Financial goal");
  const amount = requirePositiveMoney(input.amount, goal.currency);
  const date = parseIsoDate(input.date || new Date().toISOString().slice(0, 10));

  let account: { id: string; currency: string } | null = null;
  if (input.sourceAccountId) {
    account = await db.account.findFirst({ where: { id: input.sourceAccountId, deletedAt: null, archivedAt: null }, select: { id: true, currency: true } });
    if (!account) throw validationError("Choose an account.", { sourceAccountId: ["That account no longer exists or is archived."] });
    if (account.currency !== goal.currency) throw validationError(`Choose a ${goal.currency} account, to match this goal's currency.`, { sourceAccountId: [`Choose a ${goal.currency} account.`] });
  }

  await db.$transaction(async (tx) => {
    await tx.savingsContribution.create({ data: { userId: ctx.userId, financialGoalId: goal.id, amountMinor: amount.minor, currency: goal.currency, date, sourceAccountId: account?.id ?? null, notes: input.notes } });
    await tx.financialGoal.update({ where: { id: goal.id }, data: { currentMinor: { increment: amount.minor }, ...(goal.status === "ACHIEVED" ? {} : {}) } });
    if (account) await tx.account.update({ where: { id: account.id }, data: { currentBalanceMinor: { decrement: amount.minor } } });

    const updated = await tx.financialGoal.findUniqueOrThrow({ where: { id: goal.id } });
    if (updated.currentMinor >= updated.targetMinor && updated.status === "ACTIVE") {
      await tx.financialGoal.update({ where: { id: goal.id }, data: { status: "ACHIEVED" } });
    }
  });
}

export async function deleteContribution(ctx: Ctx, goalId: string, contributionId: string): Promise<void> {
  const db = forUser(ctx.userId);
  await db.$transaction(async (tx) => {
    const goal = await tx.financialGoal.findFirst({ where: { id: goalId, deletedAt: null } });
    if (!goal) throw notFound("Financial goal");
    const contribution = await tx.savingsContribution.findFirst({ where: { id: contributionId, financialGoalId: goalId } });
    if (!contribution) throw notFound("Contribution");
    await tx.savingsContribution.delete({ where: { id: contribution.id } });
    await tx.financialGoal.update({ where: { id: goalId }, data: { currentMinor: { decrement: contribution.amountMinor }, status: goal.status === "ACHIEVED" ? "ACTIVE" : goal.status } });
    if (contribution.sourceAccountId) await tx.account.update({ where: { id: contribution.sourceAccountId }, data: { currentBalanceMinor: { increment: contribution.amountMinor } } });
  });
}
