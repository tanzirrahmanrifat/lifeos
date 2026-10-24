import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContributionForm } from "@/components/financial-goals/contribution-form";
import { ContributionRow } from "@/components/financial-goals/contribution-row";
import { GoalDetailActions } from "@/components/financial-goals/goal-detail-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress";
import { requireUserOrRedirect } from "@/lib/auth/require-user";
import { formatIsoDate } from "@/lib/dates";
import { formatMoney, Money } from "@/lib/money";
import { listAccounts } from "@/modules/finance/service";
import { getFinancialGoal } from "@/modules/financial-goals/service";
import { getBundle } from "@/modules/settings/server";
import { listCategoriesOfType } from "@/modules/settings/service";
import { getClock } from "@/modules/shared/clock";

export const metadata: Metadata = { title: "Financial goal" };

const STATUS_TONE = { ACTIVE: "info", ACHIEVED: "success", PAUSED: "warning", CANCELLED: "neutral" } as const;
const STATUS_LABEL = { ACTIVE: "Active", ACHIEVED: "Achieved", PAUSED: "Paused", CANCELLED: "Cancelled" } as const;

export default async function FinancialGoalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUserOrRedirect();
  const ctx = { userId: user.id };
  const [clock, bundle] = await Promise.all([getClock(user.id), getBundle()]);
  const [goal, categories, accounts] = await Promise.all([getFinancialGoal(ctx, id, clock.today), listCategoriesOfType(ctx, "GOAL"), listAccounts(ctx)]);
  if (!goal) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/financial-goals" className="mb-4 inline-flex min-h-10 items-center gap-1 text-sm text-muted hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> All financial goals
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{goal.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone={STATUS_TONE[goal.status]}>{STATUS_LABEL[goal.status]}</Badge>
            {goal.categoryName && <Badge tone="neutral">{goal.categoryName}</Badge>}
            {goal.targetDate && <span className="text-sm text-muted">{formatIsoDate(goal.targetDate, bundle.settings.dateFormat)}</span>}
          </div>
        </div>
        <GoalDetailActions goal={goal} categories={categories} />
      </header>

      <Card className="p-5">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-muted">Target</p>
            <p className="tabular mt-1 font-semibold">{formatMoney(Money.fromDTO(goal.target))}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Current</p>
            <p className="tabular mt-1 font-semibold text-success">{formatMoney(Money.fromDTO(goal.current))}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Remaining</p>
            <p className="tabular mt-1 font-semibold">{formatMoney(Money.fromDTO(goal.remaining))}</p>
          </div>
        </div>
        <ProgressBar className="mt-4" value={goal.progressPct} tone={goal.status === "ACHIEVED" ? "success" : "primary"} label="Goal progress" />
        <p className="tabular mt-1.5 text-right text-xs text-muted">{goal.progressPct}%</p>
        {goal.requiredMonthly && (
          <p className="mt-2 text-sm text-muted">
            You need about <span className="font-medium text-foreground">{formatMoney(Money.fromDTO(goal.requiredMonthly))}</span> a month to reach this by {formatIsoDate(goal.targetDate!, bundle.settings.dateFormat)}.
          </p>
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Contributions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <ContributionForm goalId={goal.id} goalCurrency={goal.target.currency} accounts={accounts.filter((a) => !a.archived).map((a) => ({ id: a.id, name: a.name, currency: a.balance.currency }))} today={clock.today} />
          {goal.contributions.length === 0 ? (
            <EmptyState title="No contributions yet" description="Add what you've saved so far above." className="py-6" />
          ) : (
            <ul className="divide-y divide-line">
              {goal.contributions.map((c) => (
                <ContributionRow key={c.id} goalId={goal.id} contribution={c} dateFormat={bundle.settings.dateFormat} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {goal.notes && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-muted whitespace-pre-wrap">{goal.notes}</CardContent>
        </Card>
      )}
    </div>
  );
}
