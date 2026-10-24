import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddMilestoneInline } from "@/components/goals/add-milestone-inline";
import { GoalDetailActions } from "@/components/goals/goal-detail-actions";
import { MilestoneRow } from "@/components/goals/milestone-row";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress";
import { requireUserOrRedirect } from "@/lib/auth/require-user";
import { formatIsoDate, relativeDayLabel } from "@/lib/dates";
import { getGoal } from "@/modules/goals/service";
import { getBundle } from "@/modules/settings/server";
import { listCategoriesOfType } from "@/modules/settings/service";
import { getClock } from "@/modules/shared/clock";

export const metadata: Metadata = { title: "Goal" };

const STATUS_TONE = { NOT_STARTED: "neutral", IN_PROGRESS: "info", ON_HOLD: "warning", COMPLETED: "success", CANCELLED: "neutral" } as const;
const STATUS_LABEL = { NOT_STARTED: "Not started", IN_PROGRESS: "In progress", ON_HOLD: "On hold", COMPLETED: "Completed", CANCELLED: "Cancelled" } as const;

export default async function GoalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUserOrRedirect();
  const ctx = { userId: user.id };
  const [clock, bundle] = await Promise.all([getClock(user.id), getBundle()]);
  const [goal, categories] = await Promise.all([getGoal(ctx, id, clock.today), listCategoriesOfType(ctx, "GOAL")]);
  if (!goal) notFound();

  const done = goal.milestones.filter((m) => m.done).length;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/goals" className="mb-4 inline-flex min-h-10 items-center gap-1 text-sm text-muted hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> All goals
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{goal.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone={goal.overdue ? "danger" : STATUS_TONE[goal.status]}>{goal.overdue ? "Overdue" : STATUS_LABEL[goal.status]}</Badge>
            {goal.categoryName && <Badge tone="neutral">{goal.categoryName}</Badge>}
            {goal.targetDate && <span className="text-sm text-muted">{relativeDayLabel(goal.targetDate, clock.today, bundle.settings.dateFormat)}</span>}
          </div>
        </div>
        <GoalDetailActions goal={goal} categories={categories} />
      </header>
      {goal.description && <p className="-mt-2 mb-6 text-sm text-muted">{goal.description}</p>}

      <Card className="p-5">
        <div className="mb-1.5 flex justify-between text-sm">
          <span className="text-muted">{goal.milestones.length > 0 ? `${done} of ${goal.milestones.length} milestones` : "Progress"}</span>
          <span className="tabular font-medium">{goal.progress}%</span>
        </div>
        <ProgressBar value={goal.progress} tone={goal.status === "COMPLETED" ? "success" : goal.overdue ? "danger" : "primary"} label="Goal progress" className="h-2.5" />
        {goal.startDate && goal.targetDate && (
          <p className="mt-2 text-xs text-muted">
            {formatIsoDate(goal.startDate, bundle.settings.dateFormat)} → {formatIsoDate(goal.targetDate, bundle.settings.dateFormat)}
          </p>
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Milestones</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {goal.milestones.length === 0 ? (
            <EmptyState title="No milestones yet" description="Break this goal into smaller steps below." className="py-6" />
          ) : (
            <ul className="divide-y divide-line">
              {goal.milestones.map((m) => (
                <MilestoneRow key={m.id} goalId={goal.id} milestone={m} dateFormat={bundle.settings.dateFormat} />
              ))}
            </ul>
          )}
          <AddMilestoneInline goalId={goal.id} />
        </CardContent>
      </Card>

      {goal.notes && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 whitespace-pre-wrap text-sm text-muted">{goal.notes}</CardContent>
        </Card>
      )}
    </div>
  );
}
