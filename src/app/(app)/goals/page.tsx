import type { Metadata } from "next";
import { Target } from "lucide-react";
import { GoalCard } from "@/components/goals/goal-card";
import { NewGoalButton } from "@/components/goals/new-goal-button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireUserOrRedirect } from "@/lib/auth/require-user";
import { listGoals } from "@/modules/goals/service";
import { getBundle } from "@/modules/settings/server";
import { listCategoriesOfType } from "@/modules/settings/service";
import { getClock } from "@/modules/shared/clock";

export const metadata: Metadata = { title: "Goals" };

export default async function GoalsPage() {
  const user = await requireUserOrRedirect();
  const ctx = { userId: user.id };
  const [clock, bundle] = await Promise.all([getClock(user.id), getBundle()]);
  const [goals, categories] = await Promise.all([listGoals(ctx, clock.today), listCategoriesOfType(ctx, "GOAL")]);

  const open = goals.filter((g) => g.status !== "COMPLETED" && g.status !== "CANCELLED");
  const closed = goals.filter((g) => g.status === "COMPLETED" || g.status === "CANCELLED");
  const newButton = <NewGoalButton categories={categories} />;

  return (
    <>
      <PageHeader title="Goals" description="Break big outcomes into milestones and watch the progress." actions={newButton} />
      {goals.length === 0 ? (
        <Card>
          <EmptyState
            icon={Target}
            title="No goals yet"
            description="Add a goal and break it into milestones — the progress bar fills in as you complete them."
            action={<NewGoalButton categories={categories}>Create your first goal</NewGoalButton>}
          />
        </Card>
      ) : (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {open.map((g) => (
              <GoalCard key={g.id} goal={g} categories={categories} today={clock.today} dateFormat={bundle.settings.dateFormat} />
            ))}
          </div>
          {closed.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-sm font-medium text-muted hover:text-foreground">Completed & cancelled ({closed.length})</summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {closed.map((g) => (
                  <GoalCard key={g.id} goal={g} categories={categories} today={clock.today} dateFormat={bundle.settings.dateFormat} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </>
  );
}
