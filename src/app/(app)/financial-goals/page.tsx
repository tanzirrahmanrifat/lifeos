import type { Metadata } from "next";
import { PiggyBank } from "lucide-react";
import { FinancialGoalCard } from "@/components/financial-goals/goal-card";
import { NewFinancialGoalButton } from "@/components/financial-goals/new-financial-goal-button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireUserOrRedirect } from "@/lib/auth/require-user";
import { listFinancialGoals } from "@/modules/financial-goals/service";
import { getBundle } from "@/modules/settings/server";
import { listCategoriesOfType } from "@/modules/settings/service";
import { getClock } from "@/modules/shared/clock";

export const metadata: Metadata = { title: "Financial goals" };

export default async function FinancialGoalsPage() {
  const user = await requireUserOrRedirect();
  const ctx = { userId: user.id };
  const [clock, bundle] = await Promise.all([getClock(user.id), getBundle()]);
  const [goals, categories] = await Promise.all([listFinancialGoals(ctx, clock.today), listCategoriesOfType(ctx, "GOAL")]);
  const newButton = <NewFinancialGoalButton categories={categories} currency={bundle.settings.baseCurrency} />;

  const active = goals.filter((g) => g.status === "ACTIVE" || g.status === "PAUSED");
  const done = goals.filter((g) => g.status === "ACHIEVED" || g.status === "CANCELLED");

  return (
    <>
      <PageHeader title="Financial goals" description="Save toward what matters and see how far you are." actions={newButton} />
      {goals.length === 0 ? (
        <Card>
          <EmptyState icon={PiggyBank} title="No financial goals yet" description="An emergency fund, a new laptop, a trip — set a target and log contributions as you go." action={<NewFinancialGoalButton categories={categories} currency={bundle.settings.baseCurrency}>Create your first goal</NewFinancialGoalButton>} />
        </Card>
      ) : (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {active.map((g) => (
              <FinancialGoalCard key={g.id} goal={g} categories={categories} dateFormat={bundle.settings.dateFormat} />
            ))}
          </div>
          {done.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-sm font-medium text-muted hover:text-foreground">Achieved & cancelled ({done.length})</summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {done.map((g) => (
                  <FinancialGoalCard key={g.id} goal={g} categories={categories} dateFormat={bundle.settings.dateFormat} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </>
  );
}
