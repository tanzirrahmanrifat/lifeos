import type { Prisma } from "@/generated/prisma/client";
import type { Ctx } from "@/lib/auth/require-user";
import { parseIsoDate, toIsoDate } from "@/lib/dates";
import { forUser } from "@/lib/db/tenant";
import { AppError, notFound } from "@/lib/errors";
import { Money, totalsByCurrency } from "@/lib/money";
import { requireLegAccount, syncLeg, type Tx } from "@/modules/finance/ledger";
import { requirePositiveMoney } from "@/modules/finance/money-input";
import { CHARITY_EXPENSE_CATEGORY } from "@/modules/settings/default-categories";
import { assertOwnedCategory } from "@/modules/shared/categories";
import type { DonationInput, DonationListQuery } from "./schema";
import type { DonationDTO, DonationSummary } from "./types";

const include = { category: { select: { name: true, color: true } }, account: { select: { name: true } } } satisfies Prisma.DonationInclude;
type Row = Prisma.DonationGetPayload<{ include: typeof include }>;

const toDTO = (d: Row): DonationDTO => ({
  id: d.id,
  recipient: d.recipient,
  categoryId: d.categoryId,
  categoryName: d.category?.name ?? null,
  categoryColor: d.category?.color ?? null,
  amount: Money.of(d.amountMinor, d.currency).toDTO(),
  date: toIsoDate(d.date),
  accountId: d.accountId,
  accountName: d.account?.name ?? null,
  loanId: d.loanId,
  notes: d.notes,
});

const yearRange = (year: number) => ({ gte: parseIsoDate(`${year}-01-01`), lte: parseIsoDate(`${year}-12-31`) });

export async function listDonations(ctx: Ctx, query: DonationListQuery, today: string): Promise<DonationDTO[]> {
  const year = query.year ?? Number(today.slice(0, 4));
  const rows = await forUser(ctx.userId).donation.findMany({
    where: { deletedAt: null, date: yearRange(year), ...(query.categoryId ? { categoryId: query.categoryId } : {}) },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include,
  });
  return rows.map(toDTO);
}

/** Totals for the summary cards. Small data (one row per gift), so it's summed exactly in BigInt here. */
export async function getDonationSummary(ctx: Ctx, today: string, year?: number): Promise<DonationSummary> {
  const selectedYear = year ?? Number(today.slice(0, 4));
  const rows = await forUser(ctx.userId).donation.findMany({
    where: { deletedAt: null },
    select: { amountMinor: true, currency: true, date: true, categoryId: true, category: { select: { name: true, color: true } } },
  });
  const month = today.slice(0, 7);
  const items = rows.map((r) => ({ ...r, iso: toIsoDate(r.date), money: Money.of(r.amountMinor, r.currency) }));
  const inYear = items.filter((r) => r.iso.startsWith(`${selectedYear}-`));

  const groups = new Map<string, { name: string; color: string | null; values: Money[] }>();
  for (const r of inYear) {
    const key = r.categoryId ?? "";
    const g = groups.get(key) ?? { name: r.category?.name ?? "Uncategorised", color: r.category?.color ?? null, values: [] };
    g.values.push(r.money);
    groups.set(key, g);
  }

  const years = new Set(items.map((r) => Number(r.iso.slice(0, 4))));
  years.add(Number(today.slice(0, 4)));

  return {
    year: selectedYear,
    thisMonth: totalsByCurrency(items.filter((r) => r.iso.startsWith(month)).map((r) => r.money)),
    thisYear: totalsByCurrency(inYear.map((r) => r.money)),
    allTime: totalsByCurrency(items.map((r) => r.money)),
    byCategory: [...groups.entries()]
      .map(([id, g]) => ({ categoryId: id || null, categoryName: g.name, categoryColor: g.color, totals: totalsByCurrency(g.values) }))
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName)),
    years: [...years].sort((a, b) => b - a),
  };
}

/** The EXPENSE category a paid-from-account donation is booked under, so it shows in spending reports. */
async function charityExpenseCategoryId(tx: Tx, userId: string): Promise<string> {
  const found = await tx.category.findFirst({ where: { type: "EXPENSE", name: CHARITY_EXPENSE_CATEGORY.name } });
  if (found) {
    if (found.deletedAt) await tx.category.update({ where: { id: found.id }, data: { deletedAt: null } });
    return found.id;
  }
  const created = await tx.category.create({ data: { userId, type: "EXPENSE", name: CHARITY_EXPENSE_CATEGORY.name, color: CHARITY_EXPENSE_CATEGORY.color, isSystem: true } });
  return created.id;
}

/**
 * Create or edit a donation. If an account is chosen, the money really leaves it: a linked EXPENSE
 * (category "Donations") is written so balances, the expense breakdown and reports all include it.
 */
export async function saveDonation(ctx: Ctx, input: DonationInput): Promise<string> {
  const db = forUser(ctx.userId);
  await assertOwnedCategory(db, input.categoryId, "DONATION");
  const amount = requirePositiveMoney(input.amount, input.currency, "amount");

  return db.$transaction(async (tx) => {
    const existing = input.id ? await tx.donation.findFirst({ where: { id: input.id, deletedAt: null } }) : null;
    if (input.id && !existing) throw notFound("Donation");
    if (existing?.loanId && (input.accountId || existing.amountMinor !== amount.minor || existing.currency !== input.currency)) {
      throw new AppError("CONFLICT", "This donation was logged by forgiving a loan, so its amount and currency follow that loan. You can still change the category, recipient, date and notes.");
    }
    if (input.accountId && (!existing || existing.accountId !== input.accountId || existing.currency !== input.currency)) {
      await requireLegAccount(tx, input.accountId, input.currency);
    }

    const fields = { recipient: input.recipient, categoryId: input.categoryId, amountMinor: amount.minor, currency: input.currency, date: parseIsoDate(input.date), accountId: input.accountId, notes: input.notes };
    const id = existing ? (await tx.donation.update({ where: { id: existing.id }, data: fields })).id : (await tx.donation.create({ data: { userId: ctx.userId, ...fields } })).id;

    await syncLeg(
      tx,
      ctx.userId,
      { donationId: id },
      fields.accountId
        ? { type: "EXPENSE", accountId: fields.accountId, amountMinor: amount.minor, currency: fields.currency, date: fields.date, categoryId: await charityExpenseCategoryId(tx, ctx.userId), vendor: fields.recipient, notes: fields.notes ?? "Donation" }
        : null,
    );
    return id;
  });
}

export async function deleteDonation(ctx: Ctx, id: string): Promise<void> {
  const db = forUser(ctx.userId);
  await db.$transaction(async (tx) => {
    const existing = await tx.donation.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw notFound("Donation");
    if (existing.loanId) throw new AppError("CONFLICT", "This donation was logged by forgiving a loan. Open that loan and undo the forgiveness instead.");
    await syncLeg(tx, ctx.userId, { donationId: id }, null);
    await tx.donation.update({ where: { id }, data: { deletedAt: new Date() } });
  });
}
