export interface EventDTO {
  id: string;
  title: string;
  type: "MEETING" | "PERSONAL" | "DEADLINE";
  allDay: boolean;
  date: string;
  clientId: string | null;
  clientName: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  notes: string | null;
}

export type CalendarItemKind = "task" | "event" | "goal" | "milestone" | "invoice" | "project";

/** One thing on the calendar. `ref` says which record it opens; the UI turns that into a link. */
export interface CalendarItem {
  key: string;
  kind: CalendarItemKind;
  date: string;
  time: string | null;
  title: string;
  /** Extra context line, e.g. the goal a milestone belongs to. */
  subtitle: string | null;
  done: boolean;
  ref: { type: CalendarItemKind; id: string; parentId?: string };
  tone: "primary" | "info" | "warning" | "danger" | "success" | "neutral";
}

export interface HabitDaySummary {
  done: number;
  scheduled: number;
}

export interface CalendarRange {
  from: string;
  to: string;
  items: CalendarItem[];
  habitDays: Record<string, HabitDaySummary>;
}
