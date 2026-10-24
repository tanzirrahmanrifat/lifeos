import { describe, expect, it } from "vitest";
import { computeStats, isDueToday, isScheduledOn, type HabitLike } from "./streaks";

const ctx = { today: "2026-09-21", weekStartsOn: 1 }; // Monday

const daily = (over: Partial<HabitLike> = {}): HabitLike => ({
  frequency: "DAILY",
  weekdays: [],
  targetPerPeriod: 1,
  startDate: "2026-09-01",
  endDate: null,
  ...over,
});
const done = (...days: string[]) => new Set(days);

describe("daily habits", () => {
  it("counts consecutive days ending today", () => {
    const s = computeStats(daily(), done("2026-09-19", "2026-09-20", "2026-09-21"), ctx);
    expect(s.currentStreak).toBe(3);
    expect(s.longestStreak).toBe(3);
    expect(s.doneToday).toBe(true);
  });

  it("does not break the streak just because today isn't done yet", () => {
    const s = computeStats(daily(), done("2026-09-18", "2026-09-19", "2026-09-20"), ctx);
    expect(s.currentStreak).toBe(3);
    expect(s.doneToday).toBe(false);
  });

  it("resets after a missed day but remembers the longest run", () => {
    const s = computeStats(daily(), done("2026-09-05", "2026-09-06", "2026-09-07", "2026-09-08", "2026-09-20", "2026-09-21"), ctx);
    expect(s.currentStreak).toBe(2);
    expect(s.longestStreak).toBe(4);
  });

  it("has no streak when yesterday was missed", () => {
    const s = computeStats(daily(), done("2026-09-15", "2026-09-16", "2026-09-21"), ctx);
    expect(s.currentStreak).toBe(1);
    const missedYesterday = computeStats(daily(), done("2026-09-15", "2026-09-16"), ctx);
    expect(missedYesterday.currentStreak).toBe(0);
  });

  it("reports week and month progress against scheduled days", () => {
    const s = computeStats(daily(), done("2026-09-21", "2026-09-20"), ctx);
    expect(s.week).toEqual({ done: 1, target: 7 }); // Mon 21st is in this week; Sun 20th belongs to last week
    expect(s.month).toEqual({ done: 2, target: 30 });
  });

  it("measures completion over the last 30 days, ignoring an unfinished today", () => {
    const days = Array.from({ length: 10 }, (_, i) => `2026-09-${String(11 + i).padStart(2, "0")}`); // 11th..20th
    const s = computeStats(daily(), done(...days), ctx);
    expect(s.completionRate).toBe(Math.round((10 / 20) * 100)); // habit started 1 Sep: 20 scheduled days before today
  });

  it("ignores days before the start date and after the end date", () => {
    const h = daily({ startDate: "2026-09-19", endDate: "2026-09-20" });
    expect(isScheduledOn(h, "2026-09-18")).toBe(false);
    expect(isScheduledOn(h, "2026-09-19")).toBe(true);
    expect(isDueToday(h, "2026-09-21")).toBe(false);
    expect(computeStats(h, done("2026-09-19", "2026-09-20"), ctx).currentStreak).toBe(2);
  });

  it("returns an empty result before the habit starts", () => {
    const s = computeStats(daily({ startDate: "2026-10-01" }), done(), ctx);
    expect(s).toMatchObject({ currentStreak: 0, longestStreak: 0, completionRate: null });
  });
});

describe("week spanning a month boundary", () => {
  it("counts the whole week as the target even when it continues into next month", () => {
    const s = computeStats(daily(), done("2026-09-29", "2026-09-30"), { today: "2026-09-30", weekStartsOn: 1 });
    expect(s.week).toEqual({ done: 2, target: 7 }); // Mon 28 Sep … Sun 4 Oct
    expect(s.month).toEqual({ done: 2, target: 30 });
  });
});

describe("weekday habits", () => {
  const weekdays = daily({ frequency: "WEEKDAYS", weekdays: [1, 2, 3, 4, 5] });

  it("skips unscheduled days without breaking the streak", () => {
    // Fri 18th, then Mon 21st: the weekend is not scheduled.
    const s = computeStats(weekdays, done("2026-09-17", "2026-09-18", "2026-09-21"), ctx);
    expect(s.currentStreak).toBe(3);
  });

  it("only lists the habit on scheduled weekdays", () => {
    expect(isDueToday(weekdays, "2026-09-21")).toBe(true); // Monday
    expect(isDueToday(weekdays, "2026-09-20")).toBe(false); // Sunday
  });

  it("targets only scheduled days in a week", () => {
    expect(computeStats(weekdays, done(), ctx).week?.target).toBe(5);
  });
});

describe("weekly habits (N times per week)", () => {
  const weekly: HabitLike = { frequency: "WEEKLY", weekdays: [], targetPerPeriod: 3, startDate: "2026-08-31", endDate: null };

  it("builds a streak from consecutive weeks that met the target", () => {
    // Weeks starting 31 Aug, 7 Sep, 14 Sep all have 3 completions.
    const days = ["2026-08-31", "2026-09-02", "2026-09-04", "2026-09-07", "2026-09-09", "2026-09-11", "2026-09-14", "2026-09-16", "2026-09-18"];
    const s = computeStats(weekly, done(...days), ctx);
    expect(s.currentStreak).toBe(3);
    expect(s.week).toEqual({ done: 0, target: 3 }); // week of 21 Sep hasn't started counting
  });

  it("does not penalise the current week while it is still in progress", () => {
    const days = ["2026-09-14", "2026-09-16", "2026-09-18", "2026-09-21"];
    const s = computeStats(weekly, done(...days), ctx);
    expect(s.currentStreak).toBe(1);
    expect(s.week).toEqual({ done: 1, target: 3 });
  });

  it("breaks the streak when a past week falls short", () => {
    const days = ["2026-08-31", "2026-09-02", "2026-09-04", "2026-09-07", "2026-09-14", "2026-09-16", "2026-09-18"];
    const s = computeStats(weekly, done(...days), ctx);
    expect(s.currentStreak).toBe(1);
    expect(s.longestStreak).toBe(1);
  });
});

describe("monthly habits", () => {
  const monthly: HabitLike = { frequency: "MONTHLY", weekdays: [], targetPerPeriod: 2, startDate: "2026-07-01", endDate: null };

  it("counts consecutive months that met the target", () => {
    const s = computeStats(monthly, done("2026-07-03", "2026-07-20", "2026-08-05", "2026-08-25", "2026-09-02"), ctx);
    expect(s.currentStreak).toBe(2);
    expect(s.month).toEqual({ done: 1, target: 2 });
    expect(s.week).toBeNull();
  });
});
