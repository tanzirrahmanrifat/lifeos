"use client";
import { CalendarClock, Pencil } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { formatIsoDate, relativeDayLabel } from "@/lib/dates";
import type { GoalDTO } from "@/modules/goals/types";
import { GoalFormDialog } from "./goal-form-dialog";

const STATUS_TONE = { NOT_STARTED: "neutral", IN_PROGRESS: "info", ON_HOLD: "warning", COMPLETED: "success", CANCELLED: "neutral" } as const;
const STATUS_LABEL = { NOT_STARTED: "Not started", IN_PROGRESS: "In progress", ON_HOLD: "On hold", COMPLETED: "Completed", CANCELLED: "Cancelled" } as const;

export function GoalCard({ goal, categories, today, dateFormat }: { goal: GoalDTO; categories: { id: string; name: string }[]; today: string; dateFormat: string }) {
  const [editing, setEditing] = React.useState(false);
  const done = goal.milestones.filter((m) => m.done).length;

  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/goals/${goal.id}`} className="block truncate font-medium hover:underline">
            {goal.name}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge tone={goal.overdue ? "danger" : STATUS_TONE[goal.status]}>{goal.overdue ? "Overdue" : STATUS_LABEL[goal.status]}</Badge>
            {goal.categoryName && <Badge tone="neutral">{goal.categoryName}</Badge>}
          </div>
        </div>
        <Button variant="ghost" size="icon" aria-label={`Edit ${goal.name}`} onClick={() => setEditing(true)}>
          <Pencil className="size-4" />
        </Button>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-sm">
          <span className="text-muted">{goal.milestones.length > 0 ? `${done}/${goal.milestones.length} milestones` : "Progress"}</span>
          <span className="tabular font-medium">{goal.progress}%</span>
        </div>
        <ProgressBar value={goal.progress} tone={goal.status === "COMPLETED" ? "success" : goal.overdue ? "danger" : "primary"} label={`${goal.name} progress`} />
      </div>

      {goal.targetDate && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
          <CalendarClock className="size-3.5" aria-hidden />
          {goal.status === "COMPLETED" ? `Target was ${formatIsoDate(goal.targetDate, dateFormat)}` : `${relativeDayLabel(goal.targetDate, today, dateFormat)}${goal.daysLeft !== null && goal.daysLeft >= 0 ? ` · ${goal.daysLeft}d left` : ""}`}
        </p>
      )}
      <GoalFormDialog open={editing} onOpenChange={setEditing} goal={goal} categories={categories} />
    </Card>
  );
}
