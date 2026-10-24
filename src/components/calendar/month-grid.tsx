"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import * as React from "react";
import { addDaysIso, startOfMonthIso, startOfWeekIso, weekdayShortNames } from "@/lib/dates";
import { buildUrl } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import type { CalendarItem, HabitDaySummary } from "@/modules/calendar/types";

const TONE_DOT = { primary: "bg-primary", info: "bg-info", warning: "bg-warning", danger: "bg-danger", success: "bg-success", neutral: "bg-muted" } as const;

interface Props {
  month: string; // yyyy-mm
  selected: string;
  today: string;
  weekStartsOn: number;
  itemsByDay: Record<string, CalendarItem[]>;
  habitDays: Record<string, HabitDaySummary>;
  /** Restrict the grid to one week (used by the week view). */
  daysOverride?: string[];
}

export function MonthGrid({ month, selected, today, weekStartsOn, itemsByDay, habitDays, daysOverride }: Props) {
  const pathname = usePathname();
  const params = useSearchParams();
  const view = params.get("view") ?? undefined;

  let days: string[];
  if (daysOverride) {
    days = daysOverride;
  } else {
    const first = `${month}-01`;
    const gridStart = startOfWeekIso(first, weekStartsOn);
    const lastOfMonth = addDaysIso(startOfMonthIso(addDaysIso(first, 32)), -1);
    const gridEnd = startOfWeekIso(lastOfMonth, weekStartsOn) > lastOfMonth ? lastOfMonth : addDaysIso(startOfWeekIso(lastOfMonth, weekStartsOn), 6);
    days = [];
    for (let d = gridStart; d <= gridEnd; d = addDaysIso(d, 1)) days.push(d);
  }

  const dayNames = weekdayShortNames(weekStartsOn);

  return (
    <div>
      <div className="grid grid-cols-7 text-center text-xs text-muted" aria-hidden>
        {dayNames.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const inMonth = day.slice(0, 7) === month;
          const items = itemsByDay[day] ?? [];
          const habit = habitDays[day];
          const isToday = day === today;
          const isSelected = day === selected;
          return (
            <Link
              key={day}
              href={buildUrl(pathname, { view, date: day })}
              scroll={false}
              aria-current={isSelected ? "date" : undefined}
              className={cn(
                "flex min-h-20 flex-col items-start gap-1 rounded-control border p-1.5 text-left transition-colors sm:min-h-24 sm:p-2",
                inMonth ? "bg-surface" : "bg-surface/50 text-muted/60",
                isSelected ? "border-primary ring-1 ring-primary" : "border-line hover:bg-surface-2",
              )}
            >
              <span className={cn("tabular grid size-6 place-items-center rounded-full text-sm", isToday && "bg-primary font-semibold text-primary-foreground")}>{Number(day.slice(8))}</span>
              <div className="flex w-full flex-1 flex-col gap-0.5 overflow-hidden">
                {items.slice(0, 3).map((it) => (
                  <span key={it.key} className="flex items-center gap-1 truncate text-[11px] leading-tight">
                    <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[it.tone], it.done && "opacity-40")} />
                    <span className={cn("truncate", it.done && "text-muted line-through")}>{it.title}</span>
                  </span>
                ))}
                {items.length > 3 && <span className="text-[11px] text-muted">+{items.length - 3} more</span>}
              </div>
              {habit && habit.scheduled > 0 && (
                <span className={cn("tabular self-end text-[10px]", habit.done === habit.scheduled ? "text-success" : "text-muted")}>
                  {habit.done}/{habit.scheduled}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
