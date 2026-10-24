"use client";
import { X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CheckButton } from "@/components/ui/check-button";
import { formatIsoDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { deleteMilestoneAction, setMilestoneDoneAction } from "@/modules/goals/actions";
import type { MilestoneDTO } from "@/modules/goals/types";

export function MilestoneRow({ goalId, milestone, dateFormat }: { goalId: string; milestone: MilestoneDTO; dateFormat: string }) {
  const [done, setDone] = React.useState(milestone.done);
  const [, startTransition] = React.useTransition();

  const toggle = () => {
    const next = !done;
    setDone(next);
    startTransition(async () => {
      const res = await setMilestoneDoneAction({ goalId, milestoneId: milestone.id, done: next });
      if (!res.ok) {
        setDone(!next);
        toast.error(res.error.message);
      }
    });
  };

  const remove = () =>
    startTransition(async () => {
      const res = await deleteMilestoneAction({ goalId, milestoneId: milestone.id });
      if (!res.ok) toast.error(res.error.message);
    });

  return (
    <li className="flex items-center gap-1 py-1">
      <CheckButton checked={done} onToggle={toggle} label={done ? `Undo “${milestone.title}”` : `Complete “${milestone.title}”`} />
      <span className={cn("flex-1 text-sm", done && "text-muted line-through")}>{milestone.title}</span>
      {milestone.dueDate && <span className="tabular text-xs text-muted">{formatIsoDate(milestone.dueDate, dateFormat)}</span>}
      <Button variant="ghost" size="icon" aria-label={`Remove “${milestone.title}”`} onClick={remove}>
        <X className="size-4" />
      </Button>
    </li>
  );
}
