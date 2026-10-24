"use client";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { relativeDayLabel } from "@/lib/dates";
import type { CalendarItem, HabitDaySummary } from "@/modules/calendar/types";
import { CalendarLink } from "./calendar-link";
import { EventEditor } from "./event-editor";
import { CalendarItemRow } from "./item-row";

interface Props {
  date: string;
  today: string;
  items: CalendarItem[];
  habitSummary?: HabitDaySummary;
  clients?: { id: string; name: string }[];
}

/** Detail panel for one day: its agenda, opened from any calendar cell. */
export function DayAgenda({ date, today, items, habitSummary, clients = [] }: Props) {
  const [editingEventId, setEditingEventId] = React.useState<string | null>(null);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium">{relativeDayLabel(date, today)}</h2>
        {habitSummary && habitSummary.scheduled > 0 && (
          <Badge tone={habitSummary.done === habitSummary.scheduled ? "success" : "neutral"}>
            {habitSummary.done}/{habitSummary.scheduled} habits
          </Badge>
        )}
      </div>
      {items.length === 0 ? (
        <EmptyState title="Nothing scheduled" description="Add an event, or check tasks and goals dated this day." className="py-8" />
      ) : (
        <ul className="space-y-0.5">
          {items.map((item) => (
            <CalendarItemRow key={item.key} item={item} onOpenEvent={setEditingEventId} />
          ))}
        </ul>
      )}
      <div className="mt-4 border-t border-line pt-3">
        <CalendarLink date={date} label="+ Add event" />
      </div>
      <EventEditor eventId={editingEventId} defaultDate={date} clients={clients} onOpenChange={(o) => !o && setEditingEventId(null)} />
    </div>
  );
}
