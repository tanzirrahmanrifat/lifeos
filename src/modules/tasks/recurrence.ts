import { z } from "zod";
import { addDaysIso, addMonthsIso } from "@/lib/dates";

/** Stored on Task.recurrenceRule: repeat every `interval` days / weeks / months. */
export const recurrenceSchema = z.object({
  freq: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  interval: z.number().int().min(1).max(365),
});
export type Recurrence = z.infer<typeof recurrenceSchema>;

/** Reads the JSON column defensively: anything unexpected means "does not repeat". */
export function parseRecurrence(value: unknown): Recurrence | null {
  const parsed = recurrenceSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** The due date of the next occurrence, counted from the current due date (not from completion day). */
export function nextOccurrence(dueIso: string, rule: Recurrence): string {
  switch (rule.freq) {
    case "DAILY":
      return addDaysIso(dueIso, rule.interval);
    case "WEEKLY":
      return addDaysIso(dueIso, 7 * rule.interval);
    case "MONTHLY":
      return addMonthsIso(dueIso, rule.interval);
  }
}

export type RepeatChoice = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "CUSTOM";
export type RepeatUnit = "DAYS" | "WEEKS" | "MONTHS";

const UNIT_TO_FREQ = { DAYS: "DAILY", WEEKS: "WEEKLY", MONTHS: "MONTHLY" } as const;
const FREQ_TO_UNIT = { DAILY: "DAYS", WEEKLY: "WEEKS", MONTHLY: "MONTHS" } as const;

/** Form fields → stored rule. */
export function ruleFromForm(repeat: RepeatChoice, interval: number, unit: RepeatUnit): Recurrence | null {
  switch (repeat) {
    case "NONE":
      return null;
    case "CUSTOM":
      return { freq: UNIT_TO_FREQ[unit], interval };
    default:
      return { freq: repeat, interval: 1 };
  }
}

/** Stored rule → form fields. */
export function ruleToForm(rule: Recurrence | null): { repeat: RepeatChoice; repeatInterval: number; repeatUnit: RepeatUnit } {
  if (!rule) return { repeat: "NONE", repeatInterval: 1, repeatUnit: "DAYS" };
  if (rule.interval === 1) return { repeat: rule.freq, repeatInterval: 1, repeatUnit: FREQ_TO_UNIT[rule.freq] };
  return { repeat: "CUSTOM", repeatInterval: rule.interval, repeatUnit: FREQ_TO_UNIT[rule.freq] };
}

export function describeRecurrence(rule: Recurrence): string {
  if (rule.interval === 1) return { DAILY: "Every day", WEEKLY: "Every week", MONTHLY: "Every month" }[rule.freq];
  const unit = { DAILY: "days", WEEKLY: "weeks", MONTHLY: "months" }[rule.freq];
  return `Every ${rule.interval} ${unit}`;
}
