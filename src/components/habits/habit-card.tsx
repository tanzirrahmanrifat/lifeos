"use client";
import { Flame, Pencil, Trophy } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckButton } from "@/components/ui/check-button";
import { ProgressBar } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toggleHabitAction } from "@/modules/habits/actions";
import { describeFrequency } from "@/modules/habits/labels";
import type { HabitDTO } from "@/modules/habits/types";
import { HabitIcon } from "./icons";
import { HabitFormDialog } from "./habit-form-dialog";

/** One-click "done today" with an instant (optimistic) response; the server confirms in the background. */
export function useTodayToggle(habit: Pick<HabitDTO, "id" | "stats">, today: string) {
  const [done, setDone] = React.useState(habit.stats.doneToday);
  const [, startTransition] = React.useTransition();

  const toggle = () => {
    const next = !done;
    setDone(next);
    startTransition(async () => {
      const res = await toggleHabitAction({ habitId: habit.id, date: today });
      if (!res.ok) {
        setDone(!next);
        toast.error(res.error.message);
      }
    });
  };
  return { done, toggle };
}

export function HabitCard({ habit, today, categories }: { habit: HabitDTO; today: string; categories: { id: string; name: string }[] }) {
  const { done, toggle } = useTodayToggle(habit, today);
  const [editing, setEditing] = React.useState(false);
  const started = habit.startDate <= today;
  const ended = habit.endDate !== null && habit.endDate < today;
  const canCheck = !habit.archived && started && !ended;
  const { stats } = habit;
  const progress = stats.week ?? stats.month;
  const progressLabel = stats.week ? "this week" : "this month";

  return (
    <Card className={cn("p-4", habit.archived && "opacity-70")}>
      <div className="flex items-start gap-2">
        <div className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-control text-white" style={{ background: habit.color }}>
          <HabitIcon name={habit.icon} className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <Link href={`/habits/${habit.id}`} className="block truncate font-medium hover:underline">
            {habit.name}
          </Link>
          <p className="text-xs text-muted">
            {describeFrequency(habit)}
            {habit.categoryName ? ` · ${habit.categoryName}` : ""}
            {!started ? ` · starts ${habit.startDate}` : ""}
            {ended ? " · ended" : ""}
          </p>
        </div>
        {canCheck && <CheckButton checked={done} onToggle={toggle} color={habit.color} label={done ? `Undo ${habit.name} today` : `Mark ${habit.name} done today`} className="-mr-1 -mt-0.5" />}
        <Button variant="ghost" size="icon" className="-mr-2 size-9" aria-label={`Edit ${habit.name}`} onClick={() => setEditing(true)}>
          <Pencil className="size-4" />
        </Button>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-control bg-surface-2 px-2 py-2">
          <dt className="flex items-center justify-center gap-1 text-[11px] text-muted"><Flame className="size-3" aria-hidden />Streak</dt>
          <dd className="tabular text-lg font-semibold">{stats.currentStreak}</dd>
        </div>
        <div className="rounded-control bg-surface-2 px-2 py-2">
          <dt className="flex items-center justify-center gap-1 text-[11px] text-muted"><Trophy className="size-3" aria-hidden />Best</dt>
          <dd className="tabular text-lg font-semibold">{Math.max(stats.longestStreak, stats.currentStreak)}</dd>
        </div>
        <div className="rounded-control bg-surface-2 px-2 py-2">
          <dt className="text-[11px] text-muted">Rate</dt>
          <dd className="tabular text-lg font-semibold">{stats.completionRate === null ? "—" : `${stats.completionRate}%`}</dd>
        </div>
      </dl>

      {progress && progress.target > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span>{progressLabel}</span>
            <span className="tabular">
              {progress.done}/{progress.target}
            </span>
          </div>
          <ProgressBar value={progress.done} max={progress.target} label={`${habit.name} progress ${progressLabel}`} />
        </div>
      )}
      <HabitFormDialog open={editing} onOpenChange={setEditing} habit={habit} categories={categories} today={today} />
    </Card>
  );
}
