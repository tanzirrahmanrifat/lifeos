import type { Ctx } from "@/lib/auth/require-user";
import { addDaysIso, addMonthsIso, parseIsoDate, toIsoDate } from "@/lib/dates";
import { forUser } from "@/lib/db/tenant";
import { Money } from "@/lib/money";
import type { DateRange } from "./date-ranges";
import type { BusinessReport, FinancialReport, ProductivityReport } from "./types";

const OPEN_INVOICE_STATUSES = ["SENT", "VIEWED", "PARTIALLY_PAID"] as const;
const MONTH_LABEL = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function getFinancialReport(ctx: Ctx, range: DateRange, currency: string): Promise<FinancialReport> {
  const db = forUser(ctx.userId);
  const from = parseIsoDate(range.from);
  const to = parseIsoDate(range.to);

  const [incomeSum, expenseSum, savingsSum, expenseByCategory, incomeByClient, monthlyRows] = await Promise.all([
    db.transaction.aggregate({ where: { type: "INCOME", currency, deletedAt: null, date: { gte: from, lte: to } }, _sum: { amountMinor: true } }),
    db.transaction.aggregate({ where: { type: "EXPENSE", currency, deletedAt: null, date: { gte: from, lte: to } }, _sum: { amountMinor: true } }),
    db.savingsContribution.aggregate({ where: { currency, deletedAt: null, date: { gte: from, lte: to } }, _sum: { amountMinor: true } }),
    db.transaction.groupBy({ by: ["categoryId"], where: { type: "EXPENSE", currency, deletedAt: null, date: { gte: from, lte: to } }, _sum: { amountMinor: true } }),
    db.transaction.groupBy({ by: ["clientId"], where: { type: "INCOME", currency, deletedAt: null, date: { gte: from, lte: to }, clientId: { not: null } }, _sum: { amountMinor: true } }),
    db.transaction.findMany({ where: { type: { in: ["INCOME", "EXPENSE"] }, currency, deletedAt: null, date: { gte: from, lte: to } }, select: { type: true, amountMinor: true, date: true } }),
  ]);

  const catIds = expenseByCategory.map((r) => r.categoryId).filter((id): id is string => id !== null);
  const clientIds = incomeByClient.map((r) => r.clientId).filter((id): id is string => id !== null);
  const [categories, clients] = await Promise.all([
    catIds.length > 0 ? db.category.findMany({ where: { id: { in: catIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
    clientIds.length > 0 ? db.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const clientName = new Map(clients.map((c) => [c.id, c.name]));

  const buckets = new Map<string, { income: bigint; expenses: bigint }>();
  for (let d = range.from.slice(0, 7); d <= range.to.slice(0, 7); d = addMonthsIso(`${d}-01`, 1).slice(0, 7)) buckets.set(d, { income: 0n, expenses: 0n });
  for (const r of monthlyRows) {
    const key = toIsoDate(r.date).slice(0, 7);
    const b = buckets.get(key) ?? buckets.set(key, { income: 0n, expenses: 0n }).get(key)!;
    if (r.type === "INCOME") b.income += r.amountMinor;
    else b.expenses += r.amountMinor;
  }

  const income = Money.of(incomeSum._sum.amountMinor ?? 0n, currency);
  const expenses = Money.of(expenseSum._sum.amountMinor ?? 0n, currency);

  return {
    range,
    currency,
    income: income.toDTO(),
    expenses: expenses.toDTO(),
    net: income.sub(expenses).toDTO(),
    savingsContributed: Money.of(savingsSum._sum.amountMinor ?? 0n, currency).toDTO(),
    expenseByCategory: expenseByCategory
      .map((r) => ({ categoryId: r.categoryId, name: r.categoryId ? (catName.get(r.categoryId) ?? "Unknown") : "Uncategorised", amount: Money.of(r._sum.amountMinor ?? 0n, currency).toDTO() }))
      .sort((a, b) => Number(BigInt(b.amount.minor) - BigInt(a.amount.minor))),
    incomeByClient: incomeByClient
      .map((r) => ({ clientId: r.clientId as string, name: clientName.get(r.clientId as string) ?? "Unknown", amount: Money.of(r._sum.amountMinor ?? 0n, currency).toDTO() }))
      .sort((a, b) => Number(BigInt(b.amount.minor) - BigInt(a.amount.minor))),
    monthly: [...buckets.entries()].map(([month, b]) => ({
      month,
      label: `${MONTH_LABEL[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`,
      income: Money.of(b.income, currency).toDTO(),
      expenses: Money.of(b.expenses, currency).toDTO(),
      net: Money.of(b.income - b.expenses, currency).toDTO(),
    })),
  };
}

export async function getBusinessReport(ctx: Ctx, range: DateRange, today: string, currency: string): Promise<BusinessReport> {
  const db = forUser(ctx.userId);
  const from = parseIsoDate(range.from);
  const to = parseIsoDate(range.to);

  const [paymentsByClient, invoicesInRange, projects] = await Promise.all([
    db.payment.groupBy({ by: ["clientId"], where: { voidedAt: null, currency, date: { gte: from, lte: to } }, _sum: { amountMinor: true } }),
    db.invoice.findMany({ where: { deletedAt: null, currency, issueDate: { gte: from, lte: to } }, include: { client: { select: { name: true } } }, orderBy: { dueDate: "asc" } }),
    db.project.findMany({ where: { deletedAt: null }, include: { client: { select: { name: true } } } }),
  ]);

  const clientIds = paymentsByClient.map((p) => p.clientId);
  const clients = clientIds.length > 0 ? await db.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } }) : [];
  const clientName = new Map(clients.map((c) => [c.id, c.name]));

  const toRow = (inv: (typeof invoicesInRange)[number]) => ({
    id: inv.id,
    number: inv.number,
    clientName: inv.client.name,
    dueDate: toIsoDate(inv.dueDate),
    total: Money.of(inv.totalMinor, currency).toDTO(),
    balanceDue: Money.of(inv.totalMinor - inv.amountPaidMinor, currency).toDTO(),
  });

  const projectIds = projects.map((p) => p.id);
  const projectPayments = projectIds.length > 0 ? await db.invoice.findMany({ where: { projectId: { in: projectIds }, deletedAt: null }, select: { id: true, projectId: true } }) : [];
  const projectByInvoice = new Map(projectPayments.map((i) => [i.id, i.projectId as string]));
  const paymentRows = projectPayments.length > 0 ? await db.payment.findMany({ where: { voidedAt: null, invoiceId: { in: [...projectByInvoice.keys()] }, currency }, select: { invoiceId: true, amountMinor: true } }) : [];
  const revenueByProject = new Map<string, bigint>();
  for (const p of paymentRows) {
    const pid = projectByInvoice.get(p.invoiceId);
    if (pid) revenueByProject.set(pid, (revenueByProject.get(pid) ?? 0n) + p.amountMinor);
  }

  return {
    range,
    currency,
    clientRevenue: paymentsByClient
      .map((p) => ({ clientId: p.clientId, name: clientName.get(p.clientId) ?? "Unknown", revenue: Money.of(p._sum.amountMinor ?? 0n, currency).toDTO() }))
      .sort((a, b) => Number(BigInt(b.revenue.minor) - BigInt(a.revenue.minor))),
    outstandingInvoices: invoicesInRange.filter((i) => OPEN_INVOICE_STATUSES.includes(i.status as (typeof OPEN_INVOICE_STATUSES)[number])).map(toRow),
    paidInvoices: invoicesInRange.filter((i) => i.status === "PAID").map(toRow),
    overdueInvoices: invoicesInRange.filter((i) => OPEN_INVOICE_STATUSES.includes(i.status as (typeof OPEN_INVOICE_STATUSES)[number]) && toIsoDate(i.dueDate) < today).map(toRow),
    projectRevenue: projects
      .filter((p) => revenueByProject.has(p.id))
      .map((p) => ({ projectId: p.id, name: p.name, clientName: p.client.name, revenue: Money.of(revenueByProject.get(p.id) ?? 0n, currency).toDTO() }))
      .sort((a, b) => Number(BigInt(b.revenue.minor) - BigInt(a.revenue.minor))),
  };
}

export async function getProductivityReport(ctx: Ctx, range: DateRange): Promise<ProductivityReport> {
  const db = forUser(ctx.userId);
  const from = parseIsoDate(range.from);
  const to = parseIsoDate(range.to);
  const toExclusive = parseIsoDate(addDaysIso(range.to, 1));

  const [tasksCompleted, tasksCreated, completedByDay, habits, goals] = await Promise.all([
    db.task.count({ where: { deletedAt: null, status: "COMPLETED", completedAt: { gte: from, lt: toExclusive } } }),
    db.task.count({ where: { deletedAt: null, createdAt: { gte: from, lt: toExclusive } } }),
    db.task.findMany({ where: { deletedAt: null, status: "COMPLETED", completedAt: { gte: from, lt: toExclusive } }, select: { completedAt: true } }),
    db.habit.findMany({ where: { archivedAt: null, startDate: { lte: to } } }),
    db.goal.findMany({ where: { deletedAt: null, status: { notIn: ["CANCELLED"] } }, select: { id: true, name: true, progress: true, status: true }, orderBy: { updatedAt: "desc" }, take: 10 }),
  ]);

  const dayCounts = new Map<string, number>();
  for (const t of completedByDay) {
    const key = toIsoDate(t.completedAt!);
    dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
  }
  const dailyCompletions: { date: string; count: number }[] = [];
  for (let d = range.from; d <= range.to; d = addDaysIso(d, 1)) dailyCompletions.push({ date: d, count: dayCounts.get(d) ?? 0 });

  let scheduledTotal = 0;
  let doneTotal = 0;
  if (habits.length > 0) {
    const habitIds = habits.map((h) => h.id);
    const logs = await db.habitLog.findMany({ where: { habitId: { in: habitIds }, date: { gte: from, lte: to } }, select: { habitId: true, date: true } });
    const doneSet = new Set(logs.map((l) => `${l.habitId}:${toIsoDate(l.date)}`));
    const { isScheduledOn } = await import("@/modules/habits/streaks");
    for (const h of habits) {
      const like = { frequency: h.frequency, weekdays: h.weekdays, targetPerPeriod: h.targetPerPeriod, startDate: toIsoDate(h.startDate), endDate: h.endDate ? toIsoDate(h.endDate) : null };
      for (let d = range.from; d <= range.to; d = addDaysIso(d, 1)) {
        if (d < like.startDate) continue;
        if (like.frequency === "DAILY" || like.frequency === "WEEKDAYS") {
          if (isScheduledOn(like, d)) {
            scheduledTotal++;
            if (doneSet.has(`${h.id}:${d}`)) doneTotal++;
          }
        }
      }
    }
  }

  return {
    range,
    tasksCompleted,
    tasksCreated,
    habitCompletionRate: scheduledTotal > 0 ? Math.round((doneTotal / scheduledTotal) * 100) : null,
    goalProgress: goals.map((g) => ({ id: g.id, name: g.name, progress: g.progress, status: g.status })),
    dailyCompletions,
  };
}
