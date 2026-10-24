"use client";
import * as React from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { toggleHabitAction } from "@/modules/habits/actions";
import { weekdayShort } from "@/modules/habits/labels";
import type { HabitMonthDTO } from "@/modules/habits/types";

/** Calendar history: a day is a tap target — tap to mark done, tap again to undo (past days can be back-filled). */
export function HabitMonth({ habitId, month, color, weekStartsOn, today }: { habitId: string; month: HabitMonthDTO; color: string; weekStartsOn: number; today: string }) {
  const [overrides, setOverrides] = React.useState<Record<string, boolean>>({});
  const [, startTransition] = React.useTransition();
  const order = Array.from({ length: 7 }, (_, i) => (weekStartsOn + i) % 7);
  const blanks = (month.firstWeekday - weekStartsOn + 7) % 7;

  const toggle = (date: string, current: boolean) => {
    setOverrides((o) => ({ ...o, [date]: !current }));
    startTransition(async () => {
      const res = await toggleHabitAction({ habitId, date });
      if (!res.ok) {
        toast.error(res.error.message);
        setOverrides((o) => ({ ...o, [date]: current }));
      }
    });
  };

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-muted" aria-hidden>
        {order.map((d) => (
          <div key={d} className="py-1">
            {weekdayShort(d)}
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1.5">
        {Array.from({ length: blanks }).map((_, i) => (
          <div key={`b${i}`} />
        ))}
        {month.days.map((day) => {
          const done = overrides[day.date] ?? day.done;
          const locked = day.future || day.beforeStart;
          const missed = !done && !locked && day.scheduled && day.date < today;
          return (
            <button
              key={day.date}
              type="button"
              disabled={locked}
              onClick={() => toggle(day.date, done)}
              aria-pressed={done}
              aria-label={`${day.date}${done ? ", done" : day.scheduled ? ", not done" : ""}`}
              className={cn(
                "tabular relative grid aspect-square min-h-11 place-items-center rounded-control border text-sm transition-colors",
                locked && "border-transparent text-muted/40",
                !locked && !done && "border-line hover:bg-surface-2",
                !locked && !done && !day.scheduled && "text-muted",
                missed && "border-danger/40 bg-danger-soft/50",
                done && "border-transparent font-semibold text-white",
                day.date === today && !done && "ring-2 ring-primary/60",
              )}
              style={done ? { background: color } : undefined}
            >
              {Number(day.date.slice(8))}
            </button>
          );
        })}
      </div>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-3 rounded-sm" style={{ background: color }} />Done</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-3 rounded-sm border border-danger/40 bg-danger-soft/50" />Missed</span>
      </p>
    </div>
  );
}
