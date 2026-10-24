import type { Ctx } from "@/lib/auth/require-user";
import { forUser } from "@/lib/db/tenant";
import { formatMoney, Money } from "@/lib/money";
import type { SearchGroup, SearchResult } from "./types";

const PER_GROUP = 5;

/**
 * Global search across every module, grouped, capped at a few results each so it stays fast even
 * with a lot of data. Each query is scoped to the signed-in user by the tenant-scoped client.
 */
export async function globalSearch(ctx: Ctx, q: string): Promise<SearchGroup[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const db = forUser(ctx.userId);
  const contains = { contains: term, mode: "insensitive" as const };

  const [tasks, clients, projects, invoices, transactions, goals, financialGoals, habits, notes] = await Promise.all([
    db.task.findMany({ where: { deletedAt: null, title: contains }, take: PER_GROUP, select: { id: true, title: true, dueDate: true, status: true } }),
    db.client.findMany({ where: { deletedAt: null, OR: [{ name: contains }, { company: contains }, { email: contains }] }, take: PER_GROUP, select: { id: true, name: true, company: true } }),
    db.project.findMany({ where: { deletedAt: null, name: contains }, take: PER_GROUP, select: { id: true, name: true, client: { select: { name: true } } } }),
    db.invoice.findMany({ where: { deletedAt: null, OR: [{ number: contains }, { client: { name: contains } }] }, take: PER_GROUP, select: { id: true, number: true, totalMinor: true, currency: true, client: { select: { name: true } } } }),
    db.transaction.findMany({ where: { deletedAt: null, type: { in: ["INCOME", "EXPENSE"] }, OR: [{ vendor: contains }, { source: contains }, { notes: contains }] }, take: PER_GROUP, select: { id: true, vendor: true, source: true, amountMinor: true, currency: true, type: true } }),
    db.goal.findMany({ where: { deletedAt: null, name: contains }, take: PER_GROUP, select: { id: true, name: true, status: true } }),
    db.financialGoal.findMany({ where: { deletedAt: null, name: contains }, take: PER_GROUP, select: { id: true, name: true, status: true } }),
    db.habit.findMany({ where: { name: contains }, take: PER_GROUP, select: { id: true, name: true, frequency: true } }),
    db.note.findMany({ where: { deletedAt: null, OR: [{ title: contains }, { content: contains }] }, take: PER_GROUP, select: { id: true, title: true } }),
  ]);

  const groups: SearchGroup[] = [];
  const push = (kind: SearchGroup["kind"], label: string, results: SearchResult[]) => {
    if (results.length > 0) groups.push({ kind, label, results });
  };

  push("task", "Tasks", tasks.map((t) => ({ kind: "task", id: t.id, title: t.title, subtitle: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : t.status, href: `/tasks?view=all&edit=${t.id}` })));
  push("client", "Clients", clients.map((c) => ({ kind: "client", id: c.id, title: c.name, subtitle: c.company, href: `/clients/${c.id}` })));
  push("project", "Projects", projects.map((p) => ({ kind: "project", id: p.id, title: p.name, subtitle: p.client.name, href: `/projects/${p.id}` })));
  push("invoice", "Invoices", invoices.map((i) => ({ kind: "invoice", id: i.id, title: i.number, subtitle: `${i.client.name} · ${formatMoney(Money.of(i.totalMinor, i.currency))}`, href: `/invoices/${i.id}` })));
  push(
    "transaction",
    "Transactions",
    transactions.map((t) => ({ kind: "transaction", id: t.id, title: t.vendor || t.source || (t.type === "INCOME" ? "Income" : "Expense"), subtitle: formatMoney(Money.of(t.amountMinor, t.currency)), href: `/finances?q=${encodeURIComponent(t.vendor || t.source || "")}` })),
  );
  push("goal", "Goals", goals.map((g) => ({ kind: "goal", id: g.id, title: g.name, subtitle: g.status, href: `/goals/${g.id}` })));
  push("financial-goal", "Financial goals", financialGoals.map((g) => ({ kind: "financial-goal", id: g.id, title: g.name, subtitle: g.status, href: `/financial-goals/${g.id}` })));
  push("habit", "Habits", habits.map((h) => ({ kind: "habit", id: h.id, title: h.name, subtitle: h.frequency, href: `/habits/${h.id}` })));
  push("note", "Notes", notes.map((n) => ({ kind: "note", id: n.id, title: n.title, subtitle: null, href: `/notes?q=${encodeURIComponent(n.title)}` })));

  return groups;
}
