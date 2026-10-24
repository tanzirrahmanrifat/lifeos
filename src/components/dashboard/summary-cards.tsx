import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatMoney, Money } from "@/lib/money";
import type { DashboardSummary } from "@/modules/dashboard/service";

const CARDS: { key: keyof Omit<DashboardSummary, "currency">; label: string; hint: string }[] = [
  { key: "totalIncome", label: "Total income", hint: "All recorded income" },
  { key: "totalExpenses", label: "Total expenses", hint: "All recorded spending" },
  { key: "netIncome", label: "Net income", hint: "Income minus expenses" },
  { key: "currentSavings", label: "Current savings", hint: "Across savings accounts" },
  { key: "outstandingInvoices", label: "Outstanding invoices", hint: "Sent, not yet paid" },
];

export function SummaryCards({ summary }: { summary: DashboardSummary }) {
  return (
    <section aria-label="Summary" className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-6">
      {[...CARDS, { key: "monthRevenue" as const, label: "This month's revenue", hint: "Client payments received" }].map((c) => {
        const money = Money.fromDTO(summary[c.key]);
        return (
          <Card key={c.key} className="p-4 md:p-5">
            <p className="text-sm text-muted">{c.label}</p>
            <p
              className={cn(
                "tabular mt-2 truncate text-xl font-semibold tracking-tight md:text-2xl",
                c.key === "netIncome" && money.isNegative() && "text-danger",
                c.key === "netIncome" && money.isPositive() && "text-success",
              )}
              title={formatMoney(money)}
            >
              {formatMoney(money)}
            </p>
            <p className="mt-1 truncate text-xs text-muted">{c.hint}</p>
          </Card>
        );
      })}
    </section>
  );
}
