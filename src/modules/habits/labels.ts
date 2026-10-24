import type { Frequency } from "./streaks";

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Monday-first order for pickers and labels. */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
export const weekdayShort = (d: number) => DAY_SHORT[d] ?? "";

export function describeFrequency(h: { frequency: Frequency; weekdays: number[]; targetPerPeriod: number }): string {
  switch (h.frequency) {
    case "DAILY":
      return "Every day";
    case "WEEKDAYS": {
      const days = WEEKDAY_ORDER.filter((d) => h.weekdays.includes(d));
      if (days.length === 5 && !h.weekdays.includes(0) && !h.weekdays.includes(6)) return "Weekdays";
      if (days.length === 2 && h.weekdays.includes(0) && h.weekdays.includes(6)) return "Weekends";
      return days.map(weekdayShort).join(", ");
    }
    case "WEEKLY":
      return `${h.targetPerPeriod}× a week`;
    case "MONTHLY":
      return `${h.targetPerPeriod}× a month`;
  }
}
