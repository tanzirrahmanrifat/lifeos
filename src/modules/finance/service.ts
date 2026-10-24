import type { Prisma } from "@/generated/prisma/client";
import type { AccountType } from "@/generated/prisma/enums";
import type { Ctx } from "@/lib/auth/require-user";
import { parseIsoDate, toIsoDate } from "@/lib/dates";
import { forUser } from "@/lib/db/tenant";
import { AppError, notFound, validationError } from "@/lib/errors";
import { Money } from "@/lib/money";
import { assertOwnedCategory } from "@/modules/shared/categories";
import { signOf } from "./ledger";
import { requireMoney, requirePositiveMoney } from "./money-input";
import type { AccountInput, TransactionInput, TransactionListQuery, TransferInput } from "./schema";
import type { AccountDTO, TransactionDTO, TransactionListResult, TransferDTO } from "./types";

export const TXN_PAGE_SIZE = 25;

// ───────────────────────────── Accounts ─────────────────────────────

const toAccountDTO = (a: { id: string; name: string; type: AccountType; currency: string; currentBalanceMinor: bigint; isSavings: boolean; archivedAt: Date | null }): AccountDTO => ({
  id: a.id,
  name: a.name,
  type: a.type,
  currency: a.currency,
  balance: Money.of(a.currentBalanceMinor, a.currency).toDTO(),
  isSavings: a.isSavings,
  archived: a.archivedAt !== null,
});

export async function listAccounts(ctx: Ctx, opts: { includeArchived?: boolean } = {}): Promise<AccountDTO[]> {
  const rows = await forUser(ctx.userId).account.findMany({
    where: { deletedAt: null, ...(opts.includeArchived ? {} : { archivedAt: null }) },
    orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
  });
  return rows.map(toAccountDTO);
}

export async function getAccount(ctx: Ctx, id: string): Promise<AccountDTO | null> {
  const row = await forUser(ctx.userId).account.findFirst({ where: { id, deletedAt: null } });
  return row ? toAccountDTO(row) : null;
}

export async function saveAccount(ctx: Ctx, input: AccountInput): Promise<string> {
  const db = forUser(ctx.userId);

  if (input.id) {
    // Currency and opening balance are fixed once an account has transactions, so the ledger stays
    // internally consistent (no case where existing rows suddenly don't add up to the balance).
    const existing = await db.account.findFirst({ where: { id: input.id, deletedAt: null } });
    if (!existing) throw notFound("Account");
    const hasActivity = (await db.transaction.count({ where: { accountId: existing.id, deletedAt: null } })) > 0;
    if (hasActivity && (input.currency !== existing.currency)) {
      throw validationError("This account has transactions, so its currency can't be changed.", { currency: ["This account has transactions, so its currency can't be changed."] });
    }
    const updated = await db.account.update({
      where: { id: existing.id },
      data: { name: input.name, type: input.type, isSavings: input.isSavings, ...(hasActivity ? {} : { currency: input.currency }) },
    });
    return updated.id;
  }

  const opening = requireMoney(input.openingBalance, input.currency, "openingBalance");
  const created = await db.account.create({
    data: { userId: ctx.userId, name: input.name, type: input.type, currency: input.currency, isSavings: input.isSavings, openingBalanceMinor: opening.minor, currentBalanceMinor: opening.minor },
  });
  return created.id;
}

export async function archiveAccount(ctx: Ctx, id: string, archived: boolean): Promise<void> {
  const { count } = await forUser(ctx.userId).account.updateMany({ where: { id, deletedAt: null }, data: { archivedAt: archived ? new Date() : null } });
  if (count === 0) throw notFound("Account");
}

export async function deleteAccount(ctx: Ctx, id: string): Promise<void> {
  const db = forUser(ctx.userId);
  const account = await db.account.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  if (!account) throw notFound("Account");
  const activity = await db.transaction.count({ where: { accountId: id, deletedAt: null } });
  if (activity > 0) throw new AppError("CONFLICT", "This account has transactions. Archive it instead of deleting it, so its history stays intact.");
  await db.account.update({ where: { id }, data: { deletedAt: new Date() } });
}

/** Recomputes the cached balance from the ledger. Call after anything suspicious; never on the happy path. */
export async function reconcileAccount(ctx: Ctx, id: string): Promise<AccountDTO> {
  const db = forUser(ctx.userId);
  const account = await db.account.findFirst({ where: { id, deletedAt: null } });
  if (!account) throw notFound("Account");
  const sums = await db.transaction.groupBy({ by: ["type"], where: { accountId: id, deletedAt: null }, _sum: { amountMinor: true } });
  let balance = account.openingBalanceMinor;
  for (const s of sums) {
    const amt = s._sum.amountMinor ?? 0n;
    balance += signOf(s.type) * amt;
  }
  const updated = await db.account.update({ where: { id }, data: { currentBalanceMinor: balance } });
  return toAccountDTO(updated);
}

// ───────────────────────────── Transactions ─────────────────────────────

const txnInclude = { account: { select: { name: true, currency: true } }, category: { select: { name: true, color: true } } } satisfies Prisma.TransactionInclude;
type TxnRow = Prisma.TransactionGetPayload<{ include: typeof txnInclude }>;

function toTxnDTO(t: TxnRow): TransactionDTO {
  return {
    id: t.id,
    type: t.type,
    amount: Money.of(t.amountMinor, t.currency).toDTO(),
    date: toIsoDate(t.date),
    accountId: t.accountId,
    accountName: t.account.name,
    categoryId: t.categoryId,
    categoryName: t.category?.name ?? null,
    categoryColor: t.category?.color ?? null,
    vendor: t.vendor,
    source: t.source,
    notes: t.notes,
    clientId: t.clientId,
    projectId: t.projectId,
    paymentId: t.paymentId,
    transferId: t.transferId,
    donationId: t.donationId,
  };
}

export async function listTransactions(ctx: Ctx, query: TransactionListQuery): Promise<TransactionListResult> {
  const db = forUser(ctx.userId);
  const where: Prisma.TransactionWhereInput = {
    AND: [
      { deletedAt: null },
      { type: { in: ["INCOME", "EXPENSE"] } },
      query.type ? { type: query.type } : {},
      query.accountId ? { accountId: query.accountId } : {},
      query.categoryId ? { categoryId: query.categoryId } : {},
      query.from ? { date: { gte: parseIsoDate(query.from) } } : {},
      query.to ? { date: { lte: parseIsoDate(query.to) } } : {},
      query.q ? { OR: [{ vendor: { contains: query.q, mode: "insensitive" } }, { source: { contains: query.q, mode: "insensitive" } }, { notes: { contains: query.q, mode: "insensitive" } }] } : {},
    ],
  };
  const [total, rows] = await Promise.all([
    db.transaction.count({ where }),
    db.transaction.findMany({ where, orderBy: [{ date: "desc" }, { createdAt: "desc" }], skip: (query.page - 1) * TXN_PAGE_SIZE, take: TXN_PAGE_SIZE, include: txnInclude }),
  ]);
  return { items: rows.map(toTxnDTO), total, page: query.page, pageSize: TXN_PAGE_SIZE };
}

export async function getTransaction(ctx: Ctx, id: string): Promise<TransactionDTO | null> {
  const row = await forUser(ctx.userId).transaction.findFirst({ where: { id, deletedAt: null }, include: txnInclude });
  return row ? toTxnDTO(row) : null;
}

export async function getRecentTransactions(ctx: Ctx, take: number): Promise<TransactionDTO[]> {
  const rows = await forUser(ctx.userId).transaction.findMany({
    where: { deletedAt: null, type: { in: ["INCOME", "EXPENSE"] } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take,
    include: txnInclude,
  });
  return rows.map(toTxnDTO);
}

/** Create or edit an income/expense transaction, keeping the account balance exactly in sync. */
export async function saveTransaction(ctx: Ctx, input: TransactionInput): Promise<string> {
  const db = forUser(ctx.userId);
  const account = await db.account.findFirst({ where: { id: input.accountId, deletedAt: null }, select: { id: true, currency: true, archivedAt: true } });
  if (!account) throw validationError("Choose an account.", { accountId: ["That account no longer exists."] });
  if (account.archivedAt) throw validationError("That account is archived. Restore it first.", { accountId: ["That account is archived."] });
  await assertOwnedCategory(db, input.categoryId, input.type);
  const money = requirePositiveMoney(input.amount, account.currency, "amount");

  return db.$transaction(async (tx) => {
    if (input.id) {
      const existing = await tx.transaction.findFirst({ where: { id: input.id, deletedAt: null, type: { in: ["INCOME", "EXPENSE"] } } });
      if (!existing) throw notFound("Transaction");
      if (existing.paymentId) throw new AppError("FORBIDDEN", "This transaction came from an invoice payment and can't be edited here.");
      if (existing.donationId) throw new AppError("FORBIDDEN", "This expense came from a donation. Edit it from the Donations page.");

      // Reverse the old effect, then apply the new one — correct even if the account itself changed.
      await tx.account.update({ where: { id: existing.accountId }, data: { currentBalanceMinor: { increment: -signOf(existing.type) * existing.amountMinor } } });
      await tx.account.update({ where: { id: account.id }, data: { currentBalanceMinor: { increment: signOf(input.type) * money.minor } } });
      await tx.transaction.update({
        where: { id: existing.id },
        data: { type: input.type, accountId: account.id, amountMinor: money.minor, currency: account.currency, date: parseIsoDate(input.date), categoryId: input.categoryId, vendor: input.vendor, source: input.source, notes: input.notes },
      });
      return existing.id;
    }

    const created = await tx.transaction.create({
      data: { userId: ctx.userId, type: input.type, accountId: account.id, amountMinor: money.minor, currency: account.currency, date: parseIsoDate(input.date), categoryId: input.categoryId, vendor: input.vendor, source: input.source, notes: input.notes },
    });
    await tx.account.update({ where: { id: account.id }, data: { currentBalanceMinor: { increment: signOf(input.type) * money.minor } } });
    return created.id;
  });
}

export async function deleteTransaction(ctx: Ctx, id: string): Promise<void> {
  const db = forUser(ctx.userId);
  await db.$transaction(async (tx) => {
    const existing = await tx.transaction.findFirst({ where: { id, deletedAt: null, type: { in: ["INCOME", "EXPENSE"] } } });
    if (!existing) throw notFound("Transaction");
    if (existing.paymentId) throw new AppError("FORBIDDEN", "This transaction came from an invoice payment and can't be deleted here.");
    if (existing.donationId) throw new AppError("FORBIDDEN", "This expense came from a donation. Delete it from the Donations page.");
    await tx.transaction.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    await tx.account.update({ where: { id: existing.accountId }, data: { currentBalanceMinor: { increment: -signOf(existing.type) * existing.amountMinor } } });
  });
}

// ───────────────────────────── Transfers ─────────────────────────────

export async function listTransfers(ctx: Ctx, take = 20): Promise<TransferDTO[]> {
  const rows = await forUser(ctx.userId).transfer.findMany({
    where: {},
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take,
    include: { fromAccount: { select: { name: true, currency: true } }, toAccount: { select: { name: true, currency: true } } },
  });
  return rows.map((t) => ({
    id: t.id,
    fromAccountId: t.fromAccountId,
    fromAccountName: t.fromAccount.name,
    toAccountId: t.toAccountId,
    toAccountName: t.toAccount.name,
    amountFrom: Money.of(t.amountFromMinor, t.fromAccount.currency).toDTO(),
    amountTo: Money.of(t.amountToMinor, t.toAccount.currency).toDTO(),
    date: toIsoDate(t.date),
    notes: t.notes,
  }));
}

export async function saveTransfer(ctx: Ctx, input: TransferInput): Promise<string> {
  const db = forUser(ctx.userId);
  const [from, to] = await Promise.all([
    db.account.findFirst({ where: { id: input.fromAccountId, deletedAt: null } }),
    db.account.findFirst({ where: { id: input.toAccountId, deletedAt: null } }),
  ]);
  if (!from) throw validationError("Choose an account.", { fromAccountId: ["That account no longer exists."] });
  if (!to) throw validationError("Choose an account.", { toAccountId: ["That account no longer exists."] });
  if (from.archivedAt || to.archivedAt) throw validationError("Restore any archived account before transferring.");
  const amountFrom = requirePositiveMoney(input.amountFrom, from.currency, "amountFrom");
  // Same currency: the destination amount always equals the source amount (no accidental FX drift
  // from a typo). Cross-currency transfers use the destination amount the user entered.
  const amountTo = from.currency === to.currency ? amountFrom : requirePositiveMoney(input.amountTo, to.currency, "amountTo");

  return db.$transaction(async (tx) => {
    if (input.id) {
      const existing = await tx.transfer.findFirst({ where: { id: input.id } });
      if (!existing) throw notFound("Transfer");
      await tx.account.update({ where: { id: existing.fromAccountId }, data: { currentBalanceMinor: { increment: existing.amountFromMinor } } });
      await tx.account.update({ where: { id: existing.toAccountId }, data: { currentBalanceMinor: { increment: -existing.amountToMinor } } });
      await tx.transaction.deleteMany({ where: { transferId: existing.id } });
      await tx.transfer.update({
        where: { id: existing.id },
        data: { fromAccountId: from.id, toAccountId: to.id, amountFromMinor: amountFrom.minor, amountToMinor: amountTo.minor, date: parseIsoDate(input.date), notes: input.notes },
      });
      await tx.account.update({ where: { id: from.id }, data: { currentBalanceMinor: { increment: -amountFrom.minor } } });
      await tx.account.update({ where: { id: to.id }, data: { currentBalanceMinor: { increment: amountTo.minor } } });
      await tx.transaction.createMany({
        data: [
          { userId: ctx.userId, type: "TRANSFER_OUT", accountId: from.id, amountMinor: amountFrom.minor, currency: from.currency, date: parseIsoDate(input.date), transferId: existing.id, notes: input.notes },
          { userId: ctx.userId, type: "TRANSFER_IN", accountId: to.id, amountMinor: amountTo.minor, currency: to.currency, date: parseIsoDate(input.date), transferId: existing.id, notes: input.notes },
        ],
      });
      return existing.id;
    }

    const created = await tx.transfer.create({ data: { userId: ctx.userId, fromAccountId: from.id, toAccountId: to.id, amountFromMinor: amountFrom.minor, amountToMinor: amountTo.minor, date: parseIsoDate(input.date), notes: input.notes } });
    await tx.account.update({ where: { id: from.id }, data: { currentBalanceMinor: { increment: -amountFrom.minor } } });
    await tx.account.update({ where: { id: to.id }, data: { currentBalanceMinor: { increment: amountTo.minor } } });
    await tx.transaction.createMany({
      data: [
        { userId: ctx.userId, type: "TRANSFER_OUT", accountId: from.id, amountMinor: amountFrom.minor, currency: from.currency, date: parseIsoDate(input.date), transferId: created.id, notes: input.notes },
        { userId: ctx.userId, type: "TRANSFER_IN", accountId: to.id, amountMinor: amountTo.minor, currency: to.currency, date: parseIsoDate(input.date), transferId: created.id, notes: input.notes },
      ],
    });
    return created.id;
  });
}

export async function deleteTransfer(ctx: Ctx, id: string): Promise<void> {
  const db = forUser(ctx.userId);
  await db.$transaction(async (tx) => {
    const existing = await tx.transfer.findFirst({ where: { id } });
    if (!existing) throw notFound("Transfer");
    await tx.account.update({ where: { id: existing.fromAccountId }, data: { currentBalanceMinor: { increment: existing.amountFromMinor } } });
    await tx.account.update({ where: { id: existing.toAccountId }, data: { currentBalanceMinor: { increment: -existing.amountToMinor } } });
    await tx.transaction.deleteMany({ where: { transferId: existing.id } });
    await tx.transfer.delete({ where: { id: existing.id } });
  });
}

// ───────────────────────────── Budgets ─────────────────────────────

import type { BudgetInput } from "./schema";
import type { BudgetSummary, CategorySpend } from "./types";

/** Budgets are tracked in the user's base currency; only same-currency transactions count toward them. */
export async function getBudgetSummary(ctx: Ctx, month: string, baseCurrency: string): Promise<BudgetSummary> {
  const db = forUser(ctx.userId);
  const monthDate = parseIsoDate(`${month}-01`);
  const monthEndExclusive = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 1));

  const [rows, categories, spendByCategory, incomeSum] = await Promise.all([
    db.budget.findMany({ where: { month: monthDate } }),
    db.category.findMany({ where: { type: "EXPENSE", deletedAt: null }, select: { id: true, name: true, color: true } }),
    db.transaction.groupBy({
      by: ["categoryId"],
      where: { type: "EXPENSE", currency: baseCurrency, deletedAt: null, date: { gte: monthDate, lt: monthEndExclusive } },
      _sum: { amountMinor: true },
    }),
    db.transaction.aggregate({ where: { type: "INCOME", currency: baseCurrency, deletedAt: null, date: { gte: monthDate, lt: monthEndExclusive } }, _sum: { amountMinor: true } }),
  ]);

  const spendMap = new Map(spendByCategory.map((s) => [s.categoryId, s._sum.amountMinor ?? 0n]));
  const budgetByCategory = new Map(rows.filter((r) => r.kind === "EXPENSE" && r.categoryId).map((r) => [r.categoryId as string, r.amountMinor]));
  const incomeTargetRow = rows.find((r) => r.kind === "INCOME_TARGET");
  const savingsTargetRow = rows.find((r) => r.kind === "SAVINGS_TARGET");
  const m = (v: bigint | undefined | null) => Money.of(v ?? 0n, baseCurrency);

  const budgetedCategoryIds = new Set(budgetByCategory.keys());
  const lines: CategorySpend[] = categories
    .filter((c) => budgetedCategoryIds.has(c.id) || (spendMap.get(c.id) ?? 0n) > 0n)
    .map((c) => ({
      categoryId: c.id,
      categoryName: c.name,
      categoryColor: c.color,
      spent: m(spendMap.get(c.id)).toDTO(),
      budget: budgetByCategory.has(c.id) ? m(budgetByCategory.get(c.id)).toDTO() : null,
    }))
    .sort((a, b) => Number(Money.fromDTO(b.spent).minor - Money.fromDTO(a.spent).minor));

  const categorizedIds = new Set(categories.map((c) => c.id));
  const otherSpend = spendByCategory.filter((s) => !s.categoryId || !categorizedIds.has(s.categoryId)).reduce((sum, s) => sum + (s._sum.amountMinor ?? 0n), 0n);
  const totalBudgeted = [...budgetByCategory.values()].reduce((a, b) => a + b, 0n);
  const totalSpent = [...spendMap.values()].reduce((a, b) => a + b, 0n) + otherSpend;

  return {
    month,
    currency: baseCurrency,
    incomeTarget: m(incomeTargetRow?.amountMinor).toDTO(),
    incomeActual: m(incomeSum._sum.amountMinor).toDTO(),
    savingsTarget: m(savingsTargetRow?.amountMinor).toDTO(),
    savingsActual: Money.zero(baseCurrency).toDTO(), // filled in by the financial-goals module's savings total
    expenseLines: lines,
    otherExpenses: m(otherSpend).toDTO(),
    totalBudgeted: m(totalBudgeted).toDTO(),
    totalSpent: m(totalSpent).toDTO(),
  };
}

export async function saveBudget(ctx: Ctx, input: BudgetInput, baseCurrency: string): Promise<void> {
  const db = forUser(ctx.userId);
  const monthDate = parseIsoDate(`${input.month}-01`);
  const incomeTarget = requireMoney(input.incomeTarget || "0", baseCurrency, "incomeTarget");
  const savingsTarget = requireMoney(input.savingsTarget || "0", baseCurrency, "savingsTarget");

  for (const line of input.expenseLines) {
    await assertOwnedCategory(db, line.categoryId, "EXPENSE", "expenseLines");
  }

  await db.$transaction(async (tx) => {
    // Prisma's compound-unique `where` rejects a literal null for a nullable key column, and Postgres
    // treats NULL as distinct anyway (the partial unique index only guards against real races) — so
    // these two singleton rows are just found-then-written by hand.
    const upsertOne = async (kind: "INCOME_TARGET" | "SAVINGS_TARGET", amountMinor: bigint) => {
      const existing = await tx.budget.findFirst({ where: { userId: ctx.userId, month: monthDate, kind, categoryId: null } });
      if (existing) await tx.budget.update({ where: { id: existing.id }, data: { amountMinor } });
      else await tx.budget.create({ data: { userId: ctx.userId, month: monthDate, kind, categoryId: null, amountMinor, currency: baseCurrency } });
    };
    await upsertOne("INCOME_TARGET", incomeTarget.minor);
    await upsertOne("SAVINGS_TARGET", savingsTarget.minor);

    await tx.budget.deleteMany({ where: { userId: ctx.userId, month: monthDate, kind: "EXPENSE" } });
    for (const line of input.expenseLines) {
      const amount = requireMoney(line.amount || "0", baseCurrency);
      if (amount.isZero()) continue;
      await tx.budget.create({ data: { userId: ctx.userId, month: monthDate, kind: "EXPENSE", categoryId: line.categoryId, amountMinor: amount.minor, currency: baseCurrency } });
    }
  });
}
