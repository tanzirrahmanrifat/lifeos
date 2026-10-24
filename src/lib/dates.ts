import { format } from "date-fns";

/** Calendar helpers that respect the user's time zone — "today" must never depend on the server's. */

export interface LocalDate {
  year: number;
  month: number; // 1–12
  day: number;
  /** yyyy-mm-dd */
  iso: string;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  hour: number;
}

export function getLocalNow(timeZone: string, now: Date = new Date()): LocalDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return {
    year,
    month,
    day,
    iso: `${get("year")}-${get("month")}-${get("day")}`,
    weekday,
    hour: Number(get("hour")),
  };
}

/** A UTC-midnight Date for a calendar day — the representation Prisma uses for `@db.Date`. */
export const dateOnly = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day));

export function monthRange(local: Pick<LocalDate, "year" | "month">) {
  return {
    start: dateOnly(local.year, local.month, 1),
    endExclusive: dateOnly(local.year, local.month + 1, 1),
  };
}

export function greetingFor(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function formatLongDate(timeZone: string, now: Date = new Date(), locale = "en-GB"): string {
  return new Intl.DateTimeFormat(locale, { timeZone, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now);
}

// ───────────────────────── ISO calendar-day helpers ─────────────────────────
// Calendar days travel through the app as "yyyy-mm-dd" strings (never as instants), so a due date
// can't drift across time zones. They become UTC-midnight Dates only at the database boundary.

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidIsoDate(value: string): boolean {
  const m = ISO_DAY.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

export function parseIsoDate(iso: string): Date {
  if (!isValidIsoDate(iso)) throw new RangeError(`Invalid date: ${iso}`);
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

export const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);
export const toIsoDateOrNull = (date: Date | null | undefined): string | null => (date ? toIsoDate(date) : null);

export function addDaysIso(iso: string, days: number): string {
  const d = parseIsoDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIsoDate(d);
}

export function daysBetweenIso(fromIso: string, toIso: string): number {
  return Math.round((parseIsoDate(toIso).getTime() - parseIsoDate(fromIso).getTime()) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayShortNames(weekStartsOn: number): string[] {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return Array.from({ length: 7 }, (_, i) => names[(weekStartsOn + i) % 7]!);
}

export const weekdayOfIso = (iso: string): number => parseIsoDate(iso).getUTCDay();

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** First day of the week containing `iso`, where the week starts on `weekStartsOn` (0 = Sunday). */
export function startOfWeekIso(iso: string, weekStartsOn: number): string {
  const diff = (weekdayOfIso(iso) - weekStartsOn + 7) % 7;
  return addDaysIso(iso, -diff);
}

export const startOfMonthIso = (iso: string): string => `${iso.slice(0, 7)}-01`;

export function endOfMonthIso(iso: string): string {
  const [y, m] = iso.split("-").map(Number) as [number, number];
  return `${iso.slice(0, 7)}-${String(daysInMonth(y, m)).padStart(2, "0")}`;
}

/** Adds calendar months, clamping the day (31 Jan + 1 month = 28/29 Feb), never overflowing into the next month. */
export function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const nd = Math.min(d, daysInMonth(ny, nm));
  return `${String(ny).padStart(4, "0")}-${String(nm).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;
}

/** Display a calendar day with a date-fns pattern, without any time-zone shifting. */
export function formatIsoDate(iso: string, pattern = "dd MMM yyyy"): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return format(new Date(y, m - 1, d), pattern);
}

// ───────────────────────── Local time ↔ UTC instants ─────────────────────────

function tzOffsetMinutes(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** "2026-09-21" + "14:30" in `timeZone` → the exact UTC instant (handles daylight-saving changes). */
export function localDateTimeToUtc(iso: string, time: string, timeZone: string): Date {
  const [y, mo, d] = iso.split("-").map(Number) as [number, number, number];
  const [h, mi] = time.split(":").map(Number) as [number, number];
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  let guess = naive - tzOffsetMinutes(timeZone, new Date(naive)) * 60_000;
  guess = naive - tzOffsetMinutes(timeZone, new Date(guess)) * 60_000; // second pass fixes DST edges
  return new Date(guess);
}

/** A UTC instant → the calendar day and clock time it shows in `timeZone`. */
export function utcToLocalParts(instant: Date, timeZone: string): { iso: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { iso: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

// ───────────────────────── Friendly labels ─────────────────────────

/** "Today", "Tomorrow", "Yesterday", a weekday within a week, otherwise a formatted date (year hidden if this year). */
export function relativeDayLabel(iso: string, today: string, pattern = "dd MMM yyyy"): string {
  const diff = daysBetweenIso(today, iso);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (Math.abs(diff) < 7) return formatIsoDate(iso, "EEE d MMM");
  return iso.slice(0, 4) === today.slice(0, 4) ? formatIsoDate(iso, "d MMM") : formatIsoDate(iso, pattern);
}
