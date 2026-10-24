import { PieChart } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney, Money } from "@/lib/money";
import type { ExpenseSlice } from "@/modules/dashboard/service";

const PALETTE = ["#0e6b5c", "#2a5cab", "#7a4fb5", "#c2410c", "#a35a07", "#0e7490", "#be185d", "#4d7c0f", "#b7791f", "#64748b"];

/** Server-rendered donut (conic-gradient) plus a legend — no chart library, no client JS. */
export function ExpenseBreakdownWidget({ slices }: { slices: ExpenseSlice[] }) {
  const top = slices.slice(0, 6);
  const rest = slices.slice(6);
  const restTotal = rest.reduce((s, x) => s + BigInt(x.amount.minor), 0n);
  const legend = restTotal > 0n ? [...top, { categoryId: null, categoryName: "Other", categoryColor: null, amount: { minor: restTotal.toString(), currency: slices[0]?.amount.currency ?? "USD" }, pct: rest.reduce((s, x) => s + x.pct, 0) }] : top;

  const stops = legend
    .reduce<{ from: number; parts: string[] }>(
      (acc, s, i) => {
        const color = s.categoryColor ?? PALETTE[i % PALETTE.length];
        const to = acc.from + s.pct;
        acc.parts.push(`${color} ${acc.from}% ${to}%`);
        return { from: to, parts: acc.parts };
      },
      { from: 0, parts: [] },
    )
    .parts.join(", ");

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Expense breakdown</CardTitle>
      </CardHeader>
      <div className="flex-1 px-5 pb-5">
        {slices.length === 0 ? (
          <EmptyState icon={PieChart} title="No expenses this month yet" description="Record an expense and its category share will appear here." className="py-8" />
        ) : (
          <div className="flex items-center gap-5">
            <div aria-hidden className="size-28 shrink-0 rounded-full sm:size-32" style={{ background: `conic-gradient(${stops})` }} />
            <ul className="min-w-0 flex-1 space-y-1.5">
              {legend.map((s, i) => (
                <li key={s.categoryId ?? "other"} className="flex items-center gap-2 text-sm">
                  <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: s.categoryColor ?? PALETTE[i % PALETTE.length] }} />
                  <span className="min-w-0 flex-1 truncate">{s.categoryName}</span>
                  <span className="tabular shrink-0 text-muted">{formatMoney(Money.fromDTO(s.amount))}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
