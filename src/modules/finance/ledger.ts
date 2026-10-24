import type { TransactionType } from "@/generated/prisma/enums";
import type { ScopedDb } from "@/lib/db/tenant";
import { validationError } from "@/lib/errors";

export type Tx = Omit<ScopedDb, "$transaction" | "$connect" | "$disconnect" | "$on" | "$extends">;

/** +1 for money arriving in an account, -1 for money leaving it. The single source of truth for direction. */
export const signOf = (type: TransactionType): bigint => (type === "INCOME" || type === "TRANSFER_IN" || type === "LOAN_IN" ? 1n : -1n);

/** The record a ledger leg belongs to. Exactly one key is set; each is unique on `transactions`. */
export type LegOwner = { loanId: string } | { loanRepaymentId: string } | { donationId: string };

export interface LegSpec {
  type: TransactionType;
  accountId: string;
  amountMinor: bigint;
  currency: string;
  date: Date;
  categoryId?: string | null;
  vendor?: string | null;
  source?: string | null;
  notes?: string | null;
}

/**
 * Loads an account that a new leg may be written to: owned, not deleted, not archived, and in the
 * record's currency. Throws a field error on `field` otherwise.
 */
export async function requireLegAccount(db: Tx, accountId: string, currency: string, field = "accountId") {
  const account = await db.account.findFirst({
    where: { id: accountId, deletedAt: null },
    select: { id: true, currency: true, archivedAt: true },
  });
  if (!account) throw validationError("Choose an account.", { [field]: ["That account no longer exists."] });
  if (account.archivedAt) throw validationError("That account is archived. Restore it first.", { [field]: ["That account is archived."] });
  if (account.currency !== currency) {
    throw validationError(`Choose a ${currency} account, or change the currency.`, { [field]: [`This account is in ${account.currency}, not ${currency}.`] });
  }
  return account;
}

/**
 * Makes the ledger match `spec` for one owner record — in the caller's DB transaction:
 *  - reverses the previous leg's effect on its account (if it was live),
 *  - writes the new leg (re-using the same row, because the owner link is unique) or soft-deletes it
 *    when `spec` is null,
 *  - applies the new effect to the (possibly different) account.
 * Account balances therefore always equal opening balance + live legs, which `reconcileAccount()` checks.
 */
export async function syncLeg(tx: Tx, userId: string, owner: LegOwner, spec: LegSpec | null): Promise<void> {
  const existing = await tx.transaction.findFirst({ where: owner });

  if (existing && !existing.deletedAt) {
    await tx.account.update({ where: { id: existing.accountId }, data: { currentBalanceMinor: { increment: -signOf(existing.type) * existing.amountMinor } } });
  }

  if (!spec) {
    if (existing && !existing.deletedAt) await tx.transaction.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    return;
  }

  const data = {
    type: spec.type,
    accountId: spec.accountId,
    amountMinor: spec.amountMinor,
    currency: spec.currency,
    date: spec.date,
    categoryId: spec.categoryId ?? null,
    vendor: spec.vendor ?? null,
    source: spec.source ?? null,
    notes: spec.notes ?? null,
    deletedAt: null,
  };
  if (existing) await tx.transaction.update({ where: { id: existing.id }, data });
  else await tx.transaction.create({ data: { userId, ...owner, ...data } });

  await tx.account.update({ where: { id: spec.accountId }, data: { currentBalanceMinor: { increment: signOf(spec.type) * spec.amountMinor } } });
}
