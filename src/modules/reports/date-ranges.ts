import { addMonthsIso, monthRange, startOfWeekIso, toIsoDate } from "@/lib/dates";

export const REPORT_RANGES = ["today", "this_week", "this_month", "last_month", "this_year", "custom"] as const;
export type ReportRangeKey = (typeof REPORT_RANGES)[number];

export interface DateRange {
  from: string;
  to: string;
  label: string;
}

/** Resolves a named range (or a custom from/to pair) into concrete "yyyy-mm-dd" bounds, inclusive. */
export function resolveRange(key: ReportRangeKey, today: string, weekStartsOn: number, custom?: { from?: string; to?: string }): DateRange {
  const [y, m] = today.split("-").map(Number) as [number, number];
  switch (key) {
    case "today":
      return { from: today, to: today, label: "Today" };
    case "this_week": {
      const from = startOfWeekIso(today, weekStartsOn);
      return { from, to: today, label: "This week" };
    }
    case "this_month": {
      const { start } = monthRange({ year: y, month: m });
      return { from: toIsoDate(start), to: today, label: "This month" };
    }
    case "last_month": {
      const prevMonthStart = addMonthsIso(`${today.slice(0, 7)}-01`, -1);
      const { start, endExclusive } = monthRange({ year: Number(prevMonthStart.slice(0, 4)), month: Number(prevMonthStart.slice(5, 7)) });
      const end = new Date(endExclusive);
      end.setUTCDate(end.getUTCDate() - 1);
      return { from: toIsoDate(start), to: toIsoDate(end), label: "Last month" };
    }
    case "this_year":
      return { from: `${today.slice(0, 4)}-01-01`, to: today, label: "This year" };
    case "custom":
      return { from: custom?.from || today, to: custom?.to || today, label: "Custom range" };
  }
}
