import { forUser } from "@/lib/db/tenant";
import type { Ctx } from "@/lib/auth/require-user";
import { addMonthsIso, getLocalNow, monthRange, toIsoDate } from "@/lib/dates";
import { Money, type MoneyDTO } from "@/lib/money";

export interface DashboardSummary {
  currency: string;
  totalIncome: MoneyDTO;
  totalExpenses: MoneyDTO;
  netIncome: MoneyDTO;
  currentSavings: MoneyDTO;
  outstandingInvoices: MoneyDTO;
  monthRevenue: MoneyDTO;
}

const OPEN_INVOICE_STATUSES = ["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"] as const;

/**
 * Headline numbers, calculated on the server from the ledger. Only records already in the user's
 * base currency are counted; explicit FX conversion for other currencies is a later phase.
 */
export async function getDashboardSummary(ctx: Ctx, baseCurrency: string, timeZone: string): Promise<DashboardSummary> {
  const db = forUser(ctx.userId);
  const cur = baseCurrency;
  const { start, endExclusive } = monthRange(getLocalNow(timeZone));
  const m = (v: bigint | null | undefined) => Money.of(v ?? 0n, cur);

  const [income, expenses, savings, openInvoices, monthPayments] = await Promise.all([
    db.transaction.aggregate({ where: { type: "INCOME", currency: cur, deletedAt: null }, _sum: { amountMinor: true } }),
    db.transaction.aggregate({ where: { type: "EXPENSE", currency: cur, deletedAt: null }, _sum: { amountMinor: true } }),
    db.account.aggregate({
      where: { isSavings: true, currency: cur, deletedAt: null, archivedAt: null },
      _sum: { currentBalanceMinor: true },
    }),
    db.invoice.aggregate({
      where: { currency: cur, deletedAt: null, status: { in: [...OPEN_INVOICE_STATUSES] } },
      _sum: { totalMinor: true, amountPaidMinor: true },
    }),
    db.payment.aggregate({
      where: { currency: cur, voidedAt: null, date: { gte: start, lt: endExclusive } },
      _sum: { amountMinor: true },
    }),
  ]);

  const totalIncome = m(income._sum.amountMinor);
  const totalExpenses = m(expenses._sum.amountMinor);

  return {
    currency: cur,
    totalIncome: totalIncome.toDTO(),
    totalExpenses: totalExpenses.toDTO(),
    netIncome: totalIncome.sub(totalExpenses).toDTO(),
    currentSavings: m(savings._sum.currentBalanceMinor).toDTO(),
    outstandingInvoices: m(openInvoices._sum.totalMinor).sub(m(openInvoices._sum.amountPaidMinor)).toDTO(),
    monthRevenue: m(monthPayments._sum.amountMinor).toDTO(),
  };
}

export interface MonthlyPoint {
  month: string; // yyyy-mm
  label: string; // "Apr"
  income: MoneyDTO;
  expenses: MoneyDTO;
  net: MoneyDTO;
}

/** Last `months` calendar months of income vs. expenses, in the user's base currency. */
export async function getMonthlyTrend(ctx: Ctx, baseCurrency: string, today: string, months = 6): Promise<MonthlyPoint[]> {
  const db = forUser(ctx.userId);
  const startMonth = addMonthsIso(`${today.slice(0, 7)}-01`, -(months - 1));
  const rows = await db.transaction.findMany({
    where: { deletedAt: null, currency: baseCurrency, type: { in: ["INCOME", "EXPENSE"] }, date: { gte: new Date(startMonth) } },
    select: { type: true, amountMinor: true, date: true },
  });

  const buckets = new Map<string, { income: bigint; expenses: bigint }>();
  for (let i = 0; i < months; i++) {
    const key = addMonthsIso(startMonth, i).slice(0, 7);
    buckets.set(key, { income: 0n, expenses: 0n });
  }
  for (const r of rows) {
    const key = toIsoDate(r.date).slice(0, 7);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (r.type === "INCOME") bucket.income += r.amountMinor;
    else bucket.expenses += r.amountMinor;
  }

  const MONTH_LABEL = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return [...buckets.entries()].map(([month, b]) => {
    const income = Money.of(b.income, baseCurrency);
    const expenses = Money.of(b.expenses, baseCurrency);
    return { month, label: MONTH_LABEL[Number(month.slice(5, 7)) - 1]!, income: income.toDTO(), expenses: expenses.toDTO(), net: income.sub(expenses).toDTO() };
  });
}

export interface ExpenseSlice {
  categoryId: string | null;
  categoryName: string;
  categoryColor: string | null;
  amount: MoneyDTO;
  pct: number;
}

/** This month's expenses broken down by category, in the user's base currency. */
export async function getExpenseBreakdown(ctx: Ctx, baseCurrency: string, today: string): Promise<ExpenseSlice[]> {
  const db = forUser(ctx.userId);
  const { start, endExclusive } = monthRange({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) });
  const rows = await db.transaction.groupBy({
    by: ["categoryId"],
    where: { type: "EXPENSE", currency: baseCurrency, deletedAt: null, date: { gte: start, lt: endExclusive } },
    _sum: { amountMinor: true },
  });
  if (rows.length === 0) return [];

  const categoryIds = rows.map((r) => r.categoryId).filter((id): id is string => id !== null);
  const categories = categoryIds.length > 0 ? await db.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true, color: true } }) : [];
  const byId = new Map(categories.map((c) => [c.id, c]));
  const total = rows.reduce((sum, r) => sum + (r._sum.amountMinor ?? 0n), 0n);

  return rows
    .map((r) => {
      const amt = r._sum.amountMinor ?? 0n;
      const cat = r.categoryId ? byId.get(r.categoryId) : undefined;
      return {
        categoryId: r.categoryId,
        categoryName: cat?.name ?? "Uncategorised",
        categoryColor: cat?.color ?? null,
        amount: Money.of(amt, baseCurrency).toDTO(),
        pct: total > 0n ? Math.round((Number(amt) / Number(total)) * 100) : 0,
      };
    })
    .sort((a, b) => Number(BigInt(b.amount.minor) - BigInt(a.amount.minor)));
}
