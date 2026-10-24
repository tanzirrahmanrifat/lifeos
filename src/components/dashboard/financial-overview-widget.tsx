import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, Money } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { MonthlyPoint } from "@/modules/dashboard/service";

/** A dependency-free bar chart: two bars per month (income/expense), server-rendered, no client JS. */
export function FinancialOverviewWidget({ points, currency }: { points: MonthlyPoint[]; currency: string }) {
  const max = Math.max(1, ...points.flatMap((p) => [Number(p.income.minor), Number(p.expenses.minor)]));
  const totalIncome = points.reduce((s, p) => s.add(Money.fromDTO(p.income)), Money.zero(currency));
  const totalExpenses = points.reduce((s, p) => s.add(Money.fromDTO(p.expenses)), Money.zero(currency));
  const savingsRate = totalIncome.isPositive() ? Math.round((Number(totalIncome.sub(totalExpenses).minor) / Number(totalIncome.minor)) * 100) : 0;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Financial overview</CardTitle>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-full bg-success" />Income</span>
          <span className="flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-full bg-danger" />Expenses</span>
        </div>
      </CardHeader>
      <div className="flex-1 px-5 pb-5">
        <div className="flex h-40 items-end gap-3 sm:gap-4">
          {points.map((p) => (
            <div key={p.month} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-32 w-full items-end justify-center gap-1">
                <div className="w-2.5 rounded-t bg-success sm:w-3" style={{ height: `${(Number(p.income.minor) / max) * 100}%` }} title={`Income: ${formatMoney(Money.fromDTO(p.income))}`} />
                <div className="w-2.5 rounded-t bg-danger sm:w-3" style={{ height: `${(Number(p.expenses.minor) / max) * 100}%` }} title={`Expenses: ${formatMoney(Money.fromDTO(p.expenses))}`} />
              </div>
              <span className="text-[11px] text-muted">{p.label}</span>
            </div>
          ))}
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center text-sm">
          <div>
            <dt className="text-xs text-muted">Income</dt>
            <dd className="tabular font-medium text-success">{formatMoney(totalIncome)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Expenses</dt>
            <dd className="tabular font-medium text-danger">{formatMoney(totalExpenses)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Savings rate</dt>
            <dd className={cn("tabular font-medium", savingsRate < 0 && "text-danger")}>{savingsRate}%</dd>
          </div>
        </dl>
      </div>
    </Card>
  );
}
