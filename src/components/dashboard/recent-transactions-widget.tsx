import { ArrowDownLeft, ArrowUpRight, Receipt } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney, Money } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { TransactionDTO } from "@/modules/finance/types";

export function RecentTransactionsWidget({ transactions }: { transactions: TransactionDTO[] }) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Recent transactions</CardTitle>
        <Link href="/finances" className="text-sm font-medium text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <div className="flex-1 px-2 pb-4">
        {transactions.length === 0 ? (
          <EmptyState icon={Receipt} title="No transactions yet" description="Record income or an expense to see it here." action={<Link href="/finances" className={buttonVariants({ variant: "outline", size: "sm" })}>Go to finances</Link>} className="py-8" />
        ) : (
          <ul className="space-y-0.5">
            {transactions.slice(0, 6).map((t) => {
              const income = t.type === "INCOME";
              return (
                <li key={t.id} className="flex items-center gap-2.5 rounded-control px-3 py-2 hover:bg-surface-2/60">
                  <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", income ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
                    {income ? <ArrowDownLeft className="size-3.5" aria-hidden /> : <ArrowUpRight className="size-3.5" aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{t.vendor || t.source || t.categoryName || (income ? "Income" : "Expense")}</span>
                  <span className={cn("tabular shrink-0 text-sm font-medium", income ? "text-success" : "text-danger")}>
                    {income ? "+" : "−"}
                    {formatMoney(Money.fromDTO(t.amount).abs())}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
