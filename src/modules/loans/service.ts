import type { Prisma } from "@/generated/prisma/client";
import type { LoanDirection, TransactionType } from "@/generated/prisma/enums";
import type { Ctx } from "@/lib/auth/require-user";
import { parseIsoDate, toIsoDate } from "@/lib/dates";
import { forUser } from "@/lib/db/tenant";
import { AppError, notFound, validationError } from "@/lib/errors";
import { Money, totalsByCurrency } from "@/lib/money";
import { requireLegAccount, syncLeg, type Tx } from "@/modules/finance/ledger";
import { requirePositiveMoney } from "@/modules/finance/money-input";
import { assertOwnedCategory } from "@/modules/shared/categories";
import type { ForgiveInput, LoanInput, LoanListQuery, RepaymentInput } from "./schema";
import type { LoanDetailDTO, LoanDTO, LoanStatus, LoanTotals } from "./types";

// ───────────────────────────── Ledger direction ─────────────────────────────

/** Giving a loan moves money out; taking one moves money in. */
const disbursementType = (d: LoanDirection): TransactionType => (d === "LENT" ? "LOAN_OUT" : "LOAN_IN");
/** Repayments flow the other way: a borrower pays you back (in), or you pay a lender back (out). */
const repaymentType = (d: LoanDirection): TransactionType => (d === "LENT" ? "LOAN_IN" : "LOAN_OUT");

// ───────────────────────────── Reads ─────────────────────────────

const loanInclude = { account: { select: { name: true } } } satisfies Prisma.LoanInclude;
type LoanRow = Prisma.LoanGetPayload<{ include: typeof loanInclude }>;

function statusOf(row: { principalMinor: bigint; repaidMinor: bigint; forgivenAt: Date | null }): LoanStatus {
  if (row.forgivenAt) return "FORGIVEN";
  if (row.repaidMinor >= row.principalMinor) return "SETTLED";
  return row.repaidMinor > 0n ? "PARTIAL" : "OPEN";
}

const isClosed = (s: LoanStatus) => s === "SETTLED" || s === "FORGIVEN";

function toDTO(r: LoanRow, today: string, hasRepayments: boolean): LoanDTO {
  const principal = Money.of(r.principalMinor, r.currency);
  const repaid = Money.of(r.repaidMinor, r.currency);
  const forgiven = Money.of(r.forgivenMinor, r.currency);
  const rest = principal.sub(repaid).sub(forgiven);
  const outstanding = rest.isNegative() ? Money.zero(r.currency) : rest;
  const status = statusOf(r);
  const dueDate = r.dueDate ? toIsoDate(r.dueDate) : null;
  return {
    id: r.id,
    direction: r.direction,
    kind: r.kind,
    personName: r.personName,
    personPhone: r.personPhone,
    principal: principal.toDTO(),
    repaid: repaid.toDTO(),
    forgiven: forgiven.toDTO(),
    outstanding: outstanding.toDTO(),
    progressPct: principal.isPositive() ? Math.min(100, Math.round((Number(r.repaidMinor + r.forgivenMinor) / Number(r.principalMinor)) * 100)) : 0,
    date: toIsoDate(r.date),
    dueDate,
    overdue: !isClosed(status) && dueDate !== null && dueDate < today,
    status,
    accountId: r.accountId,
    accountName: r.account?.name ?? null,
    notes: r.notes,
    locked: hasRepayments || r.forgivenAt !== null,
  };
}

async function repaymentCounts(db: Tx, ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = await db.loanRepayment.groupBy({ by: ["loanId"], where: { loanId: { in: ids }, deletedAt: null }, _count: { _all: true } });
  return new Map(rows.map((r) => [r.loanId, r._count._all]));
}

export async function listLoans(ctx: Ctx, today: string, query: LoanListQuery): Promise<LoanDTO[]> {
  const db = forUser(ctx.userId);
  const rows = await db.loan.findMany({
    where: { deletedAt: null, direction: query.direction, ...(query.kind ? { kind: query.kind } : {}) },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { date: "desc" }, { createdAt: "desc" }],
    include: loanInclude,
  });
  const counts = await repaymentCounts(db, rows.map((r) => r.id));
  const all = rows.map((r) => toDTO(r, today, (counts.get(r.id) ?? 0) > 0));
  if (query.status === "all") return all;
  return all.filter((l) => (query.status === "open" ? !isClosed(l.status) : isClosed(l.status)));
}

/** Outstanding amounts across every loan, per currency. Used for the summary cards and the dashboard. */
export async function getLoanTotals(ctx: Ctx, today: string): Promise<LoanTotals> {
  const rows = await forUser(ctx.userId).loan.findMany({
    where: { deletedAt: null, forgivenAt: null },
    select: { direction: true, kind: true, principalMinor: true, repaidMinor: true, forgivenMinor: true, currency: true, dueDate: true },
  });
  const open = rows
    .map((r) => ({ ...r, left: Money.of(r.principalMinor - r.repaidMinor - r.forgivenMinor, r.currency) }))
    .filter((r) => r.left.isPositive());
  const pick = (direction: LoanDirection, qardOnly: boolean) => totalsByCurrency(open.filter((r) => r.direction === direction && (!qardOnly || r.kind === "QARD_HASAN")).map((r) => r.left));
  return {
    receivable: pick("LENT", false),
    payable: pick("BORROWED", false),
    qardHasanReceivable: pick("LENT", true),
    qardHasanPayable: pick("BORROWED", true),
    overdueCount: open.filter((r) => r.dueDate && toIsoDate(r.dueDate) < today).length,
    openCount: open.length,
  };
}

export async function getLoan(ctx: Ctx, id: string, today: string): Promise<LoanDetailDTO | null> {
  const row = await forUser(ctx.userId).loan.findFirst({
    where: { id, deletedAt: null },
    include: {
      ...loanInclude,
      repayments: { where: { deletedAt: null }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], include: { account: { select: { name: true } } } },
    },
  });
  if (!row) return null;
  return {
    ...toDTO(row, today, row.repayments.length > 0),
    repayments: row.repayments.map((p) => ({
      id: p.id,
      amount: Money.of(p.amountMinor, p.currency).toDTO(),
      date: toIsoDate(p.date),
      accountId: p.accountId,
      accountName: p.account?.name ?? null,
      notes: p.notes,
    })),
  };
}

// ───────────────────────────── Writes ─────────────────────────────

const legNote = (direction: LoanDirection, person: string) => (direction === "LENT" ? `Loan given to ${person}` : `Loan taken from ${person}`);
const repaymentNote = (direction: LoanDirection, person: string) => (direction === "LENT" ? `Loan repaid by ${person}` : `Loan repaid to ${person}`);

/**
 * Create or edit a loan. If an account is chosen, the money really moves (a LOAN_OUT / LOAN_IN leg
 * in the ledger keeps the account balance exact). Once a repayment exists or the rest was forgiven,
 * the money fields lock so repayments always refer to the amount they were made against.
 */
export async function saveLoan(ctx: Ctx, input: LoanInput): Promise<string> {
  const db = forUser(ctx.userId);
  const amount = requirePositiveMoney(input.amount, input.currency, "amount");
  if (input.dueDate && input.dueDate < input.date) {
    throw validationError("The due date can't be before the loan date.", { dueDate: ["The due date can't be before the loan date."] });
  }

  return db.$transaction(async (tx) => {
    const fields = {
      direction: input.direction,
      kind: input.kind,
      personName: input.personName,
      personPhone: input.personPhone,
      principalMinor: amount.minor,
      currency: input.currency,
      date: parseIsoDate(input.date),
      dueDate: input.dueDate ? parseIsoDate(input.dueDate) : null,
      accountId: input.accountId,
      notes: input.notes,
    };

    const existing = input.id ? await tx.loan.findFirst({ where: { id: input.id, deletedAt: null } }) : null;
    if (input.id && !existing) throw notFound("Loan");
    // Only validate the account when it's new or the money moves somewhere else, so editing the
    // notes of an old loan whose account was later archived still works.
    if (fields.accountId && (!existing || existing.accountId !== fields.accountId || existing.currency !== fields.currency)) {
      await requireLegAccount(tx, fields.accountId, fields.currency);
    }

    let loanId: string;
    if (existing) {
      const repayments = await tx.loanRepayment.count({ where: { loanId: existing.id, deletedAt: null } });
      const moneyChanged =
        existing.direction !== fields.direction ||
        existing.principalMinor !== fields.principalMinor ||
        existing.currency !== fields.currency ||
        existing.accountId !== fields.accountId ||
        toIsoDate(existing.date) !== input.date;
      if ((repayments > 0 || existing.forgivenAt) && moneyChanged) {
        throw new AppError("CONFLICT", "This loan already has repayments, so its amount, currency, account, date and direction are locked. You can still edit the name, phone, type, due date and notes.");
      }
      await tx.loan.update({ where: { id: existing.id }, data: fields });
      loanId = existing.id;
    } else {
      loanId = (await tx.loan.create({ data: { userId: ctx.userId, ...fields } })).id;
    }

    await syncLeg(
      tx,
      ctx.userId,
      { loanId },
      fields.accountId
        ? { type: disbursementType(fields.direction), accountId: fields.accountId, amountMinor: amount.minor, currency: fields.currency, date: fields.date, ...(fields.direction === "LENT" ? { vendor: fields.personName } : { source: fields.personName }), notes: legNote(fields.direction, fields.personName) }
        : null,
    );
    return loanId;
  });
}

/** Soft-deletes the loan, its repayments and every ledger leg, restoring each account's balance. */
export async function deleteLoan(ctx: Ctx, id: string): Promise<void> {
  const db = forUser(ctx.userId);
  await db.$transaction(async (tx) => {
    const loan = await tx.loan.findFirst({ where: { id, deletedAt: null } });
    if (!loan) throw notFound("Loan");
    const repayments = await tx.loanRepayment.findMany({ where: { loanId: id, deletedAt: null }, select: { id: true } });
    for (const r of repayments) await syncLeg(tx, ctx.userId, { loanRepaymentId: r.id }, null);
    await syncLeg(tx, ctx.userId, { loanId: id }, null);
    const now = new Date();
    await tx.loanRepayment.updateMany({ where: { loanId: id, deletedAt: null }, data: { deletedAt: now } });
    await tx.donation.updateMany({ where: { loanId: id, deletedAt: null }, data: { deletedAt: now } });
    await tx.loan.update({ where: { id }, data: { deletedAt: now } });
  });
}

export async function addRepayment(ctx: Ctx, input: RepaymentInput): Promise<void> {
  const db = forUser(ctx.userId);
  const loan = await db.loan.findFirst({ where: { id: input.loanId, deletedAt: null } });
  if (!loan) throw notFound("Loan");
  if (loan.forgivenAt) throw new AppError("CONFLICT", "The rest of this loan was forgiven. Undo that first to record a repayment.");
  const amount = requirePositiveMoney(input.amount, loan.currency, "amount");
  if (input.accountId) await requireLegAccount(db, input.accountId, loan.currency);

  await db.$transaction(async (tx) => {
    // The overpayment check is part of the UPDATE's WHERE clause, so it's atomic: if two repayments
    // race, Postgres re-checks the condition against the row the first one committed and the second
    // matches nothing.
    const fresh = await tx.loan.findFirstOrThrow({ where: { id: loan.id } });
    const maxRepaidBefore = fresh.principalMinor - fresh.forgivenMinor - amount.minor;
    const { count } = await tx.loan.updateMany({
      where: { id: loan.id, deletedAt: null, forgivenAt: null, repaidMinor: { lte: maxRepaidBefore } },
      data: { repaidMinor: { increment: amount.minor } },
    });
    if (count === 0) {
      const current = await tx.loan.findFirstOrThrow({ where: { id: loan.id } });
      const outstanding = current.principalMinor - current.repaidMinor - current.forgivenMinor;
      const left = Money.of(outstanding > 0n ? outstanding : 0n, loan.currency).toMajorString();
      throw validationError(`That's more than what's left (${left} ${loan.currency}).`, { amount: [`At most ${left} ${loan.currency} is left on this loan.`] });
    }
    const date = parseIsoDate(input.date);
    const repayment = await tx.loanRepayment.create({ data: { userId: ctx.userId, loanId: loan.id, amountMinor: amount.minor, currency: loan.currency, date, accountId: input.accountId, notes: input.notes } });
    if (input.accountId) {
      await syncLeg(tx, ctx.userId, { loanRepaymentId: repayment.id }, { type: repaymentType(loan.direction), accountId: input.accountId, amountMinor: amount.minor, currency: loan.currency, date, ...(loan.direction === "LENT" ? { source: loan.personName } : { vendor: loan.personName }), notes: repaymentNote(loan.direction, loan.personName) });
    }
  });
}

export async function deleteRepayment(ctx: Ctx, loanId: string, repaymentId: string): Promise<void> {
  const db = forUser(ctx.userId);
  await db.$transaction(async (tx) => {
    const loan = await tx.loan.findFirst({ where: { id: loanId, deletedAt: null } });
    if (!loan) throw notFound("Loan");
    if (loan.forgivenAt) throw new AppError("CONFLICT", "The rest of this loan was forgiven. Undo that first to change its repayments.");
    const repayment = await tx.loanRepayment.findFirst({ where: { id: repaymentId, loanId, deletedAt: null } });
    if (!repayment) throw notFound("Repayment");
    await syncLeg(tx, ctx.userId, { loanRepaymentId: repayment.id }, null);
    await tx.loanRepayment.update({ where: { id: repayment.id }, data: { deletedAt: new Date() } });
    await tx.loan.update({ where: { id: loanId }, data: { repaidMinor: { decrement: repayment.amountMinor } } });
  });
}

/**
 * Waives what's left of a loan you gave (মাফ করে দেওয়া). Optionally logs the waived amount as a
 * donation — no account moves, because the money already left when the loan was given.
 */
export async function forgiveLoan(ctx: Ctx, input: ForgiveInput, today: string): Promise<void> {
  const db = forUser(ctx.userId);
  if (input.recordAsDonation) await assertOwnedCategory(db, input.donationCategoryId, "DONATION", "donationCategoryId");
  await db.$transaction(async (tx) => {
    const loan = await tx.loan.findFirst({ where: { id: input.loanId, deletedAt: null } });
    if (!loan) throw notFound("Loan");
    if (loan.direction !== "LENT") throw new AppError("FORBIDDEN", "Only a loan you gave can be forgiven.");
    if (loan.forgivenAt) throw new AppError("CONFLICT", "This loan was already forgiven.");
    const left = loan.principalMinor - loan.repaidMinor;
    if (left <= 0n) throw new AppError("CONFLICT", "This loan is already fully repaid.");
    await tx.loan.update({ where: { id: loan.id }, data: { forgivenMinor: left, forgivenAt: new Date() } });
    if (input.recordAsDonation) {
      await tx.donation.create({
        data: { userId: ctx.userId, recipient: loan.personName, categoryId: input.donationCategoryId, amountMinor: left, currency: loan.currency, date: parseIsoDate(today), loanId: loan.id, notes: "Forgave the rest of a loan" },
      });
    }
  });
}

/** Reverses a forgiveness and removes the donation it logged, if any. */
export async function unforgiveLoan(ctx: Ctx, loanId: string): Promise<void> {
  const db = forUser(ctx.userId);
  await db.$transaction(async (tx) => {
    const loan = await tx.loan.findFirst({ where: { id: loanId, deletedAt: null } });
    if (!loan) throw notFound("Loan");
    if (!loan.forgivenAt) throw new AppError("CONFLICT", "This loan isn't forgiven.");
    await tx.loan.update({ where: { id: loanId }, data: { forgivenMinor: 0n, forgivenAt: null } });
    await tx.donation.updateMany({ where: { loanId, deletedAt: null, accountId: null }, data: { deletedAt: new Date() } });
  });
}
