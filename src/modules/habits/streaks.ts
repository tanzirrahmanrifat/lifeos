import { addDaysIso, addMonthsIso, daysBetweenIso, daysInMonth, startOfMonthIso, startOfWeekIso, weekdayOfIso } from "@/lib/dates";

export type Frequency = "DAILY" | "WEEKDAYS" | "WEEKLY" | "MONTHLY";

export interface HabitLike {
  frequency: Frequency;
  /** 0 = Sunday … 6 = Saturday; only used by WEEKDAYS. */
  weekdays: number[];
  /** Completions needed per week (WEEKLY) or per month (MONTHLY). */
  targetPerPeriod: number;
  startDate: string;
  endDate: string | null;
}

export interface StatsContext {
  today: string;
  weekStartsOn: number;
}

export interface Progress {
  done: number;
  target: number;
}

export interface HabitStats {
  currentStreak: number;
  longestStreak: number;
  /** 0–100, or null when there is nothing to measure yet. */
  completionRate: number | null;
  week: Progress | null;
  month: Progress | null;
  doneToday: boolean;
}

/** Day-based habits have fixed days; WEEKLY/MONTHLY habits are flexible (any day counts). */
export const isDayBased = (h: HabitLike) => h.frequency === "DAILY" || h.frequency === "WEEKDAYS";

export function isActiveOn(h: HabitLike, iso: string): boolean {
  return iso >= h.startDate && (h.endDate === null || iso <= h.endDate);
}

/** Is this a day the habit is expected to be done? Flexible habits never have fixed days. */
export function isScheduledOn(h: HabitLike, iso: string): boolean {
  if (!isActiveOn(h, iso)) return false;
  if (h.frequency === "DAILY") return true;
  if (h.frequency === "WEEKDAYS") return h.weekdays.includes(weekdayOfIso(iso));
  return false;
}

/** Should it appear on today's checklist? */
export function isDueToday(h: HabitLike, today: string): boolean {
  if (!isActiveOn(h, today)) return false;
  return isDayBased(h) ? isScheduledOn(h, today) : true;
}

function periodStart(h: HabitLike, iso: string, weekStartsOn: number): string {
  return h.frequency === "WEEKLY" ? startOfWeekIso(iso, weekStartsOn) : startOfMonthIso(iso);
}

function nextPeriod(h: HabitLike, start: string): string {
  return h.frequency === "WEEKLY" ? addDaysIso(start, 7) : addMonthsIso(start, 1);
}

const RATE_WINDOW_DAYS = 30;
const RATE_WINDOW_WEEKS = 8;
const RATE_WINDOW_MONTHS = 6;

export function computeStats(h: HabitLike, doneDates: ReadonlySet<string>, ctx: StatsContext): HabitStats {
  const { today, weekStartsOn } = ctx;
  const doneToday = doneDates.has(today);
  const empty: HabitStats = { currentStreak: 0, longestStreak: 0, completionRate: null, week: null, month: null, doneToday };
  if (today < h.startDate) return empty;
  const end = h.endDate !== null && h.endDate < today ? h.endDate : today;

  const weekStart = startOfWeekIso(today, weekStartsOn);
  const weekEnd = addDaysIso(weekStart, 6);
  const monthStart = startOfMonthIso(today);
  const [y, m] = today.split("-").map(Number) as [number, number];
  const monthEnd = `${today.slice(0, 7)}-${String(daysInMonth(y, m)).padStart(2, "0")}`;

  if (isDayBased(h)) {
    let run = 0;
    let longest = 0;
    let scheduledWindow = 0;
    let doneWindow = 0;
    const windowStart = addDaysIso(today, -(RATE_WINDOW_DAYS - 1));
    let weekTarget = 0;
    let weekDone = 0;
    let monthTarget = 0;
    let monthDone = 0;

    const limit = [monthEnd, weekEnd, end].reduce((a, b) => (a > b ? a : b));
    for (let day = h.startDate; day <= limit; day = addDaysIso(day, 1)) {
      const scheduled = isScheduledOn(h, day);
      const done = doneDates.has(day);
      if (day >= weekStart && day <= weekEnd && scheduled) {
        weekTarget++;
        if (done) weekDone++;
      }
      if (day >= monthStart && day <= monthEnd && scheduled) {
        monthTarget++;
        if (done) monthDone++;
      }
      if (day > end) continue; // future days only feed the week/month targets above
      if (!scheduled) continue;
      if (day === today && !done) continue; // today isn't over yet — it can't break a streak
      if (done) {
        run++;
        if (run > longest) longest = run;
      } else {
        run = 0;
      }
      if (day >= windowStart) {
        scheduledWindow++;
        if (done) doneWindow++;
      }
    }

    return {
      currentStreak: run,
      longestStreak: longest,
      completionRate: scheduledWindow === 0 ? null : Math.round((doneWindow / scheduledWindow) * 100),
      week: { done: weekDone, target: weekTarget },
      month: { done: monthDone, target: monthTarget },
      doneToday,
    };
  }

  // WEEKLY / MONTHLY: a period is "met" when it holds at least `targetPerPeriod` completions.
  const counts = new Map<string, number>();
  for (const d of doneDates) {
    if (d < h.startDate || d > end) continue;
    const key = periodStart(h, d, weekStartsOn);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const currentKey = periodStart(h, today, weekStartsOn);
  let run = 0;
  let longest = 0;
  const past: boolean[] = [];
  for (let p = periodStart(h, h.startDate, weekStartsOn); p <= currentKey; p = nextPeriod(h, p)) {
    const met = (counts.get(p) ?? 0) >= h.targetPerPeriod;
    if (p === currentKey && !met) continue; // current period still in progress
    past.push(met);
    if (met) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }
  const windowSize = h.frequency === "WEEKLY" ? RATE_WINDOW_WEEKS : RATE_WINDOW_MONTHS;
  const windowed = past.slice(-windowSize);
  const doneInMonth = [...doneDates].filter((d) => d >= monthStart && d <= monthEnd && d >= h.startDate).length;

  return {
    currentStreak: run,
    longestStreak: longest,
    completionRate: windowed.length === 0 ? null : Math.round((windowed.filter(Boolean).length / windowed.length) * 100),
    week: h.frequency === "WEEKLY" ? { done: counts.get(currentKey) ?? 0, target: h.targetPerPeriod } : null,
    month:
      h.frequency === "WEEKLY"
        ? { done: doneInMonth, target: h.targetPerPeriod * Math.ceil(daysInMonth(y, m) / 7) }
        : { done: counts.get(currentKey) ?? 0, target: h.targetPerPeriod },
    doneToday,
  };
}

/** Days since the habit began, for "day N" style labels. */
export const habitAgeDays = (h: HabitLike, today: string) => Math.max(0, daysBetweenIso(h.startDate, today)) + 1;
