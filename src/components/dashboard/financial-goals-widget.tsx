import { PiggyBank } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress";
import { formatMoney, Money } from "@/lib/money";
import type { FinancialGoalDTO } from "@/modules/financial-goals/types";

export function FinancialGoalsWidget({ goals }: { goals: FinancialGoalDTO[] }) {
  const active = goals.filter((g) => g.status === "ACTIVE").slice(0, 4);
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Financial goals</CardTitle>
        <Link href="/financial-goals" className="text-sm font-medium text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <div className="flex-1 space-y-4 px-5 pb-5">
        {active.length === 0 ? (
          <EmptyState icon={PiggyBank} title="No active financial goals" description="Set a target and track what you save toward it." action={<Link href="/financial-goals" className={buttonVariants({ variant: "outline", size: "sm" })}>Add a goal</Link>} className="py-8" />
        ) : (
          active.map((g) => (
            <div key={g.id}>
              <div className="mb-1 flex justify-between text-sm">
                <Link href={`/financial-goals/${g.id}`} className="min-w-0 truncate font-medium hover:underline">
                  {g.name}
                </Link>
                <span className="tabular shrink-0 text-muted">
                  {formatMoney(Money.fromDTO(g.current))} / {formatMoney(Money.fromDTO(g.target))}
                </span>
              </div>
              <ProgressBar value={g.progressPct} label={`${g.name} progress`} />
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
