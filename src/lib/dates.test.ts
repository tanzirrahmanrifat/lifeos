import { describe, expect, it } from "vitest";
import { getLocalNow, greetingFor, monthRange } from "./dates";

describe("dates", () => {
  it("resolves 'today' in the user's time zone, not the server's", () => {
    const instant = new Date("2026-09-20T20:30:00Z");
    expect(getLocalNow("Asia/Dhaka", instant).iso).toBe("2026-09-21"); // UTC+6 → already tomorrow
    expect(getLocalNow("America/Los_Angeles", instant).iso).toBe("2026-09-20");
    expect(getLocalNow("Asia/Dhaka", instant).weekday).toBe(1); // Monday
  });

  it("computes month ranges", () => {
    const r = monthRange({ year: 2026, month: 12 });
    expect(r.start.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(r.endExclusive.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("picks a greeting by hour", () => {
    expect(greetingFor(8)).toBe("Good morning");
    expect(greetingFor(13)).toBe("Good afternoon");
    expect(greetingFor(20)).toBe("Good evening");
  });
});

import {
  addDaysIso,
  addMonthsIso,
  daysBetweenIso,
  endOfMonthIso,
  isValidIsoDate,
  localDateTimeToUtc,
  startOfWeekIso,
  utcToLocalParts,
  weekdayOfIso,
  formatIsoDate,
} from "./dates";

describe("iso calendar helpers", () => {
  it("validates real calendar days only", () => {
    expect(isValidIsoDate("2026-02-28")).toBe(true);
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("2026-13-01")).toBe(false);
    expect(isValidIsoDate("2026-1-1")).toBe(false);
  });

  it("adds days across month and year boundaries", () => {
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysIso("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetweenIso("2026-09-01", "2026-09-21")).toBe(20);
  });

  it("clamps month arithmetic instead of overflowing", () => {
    expect(addMonthsIso("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsIso("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonthsIso("2026-11-15", 3)).toBe("2027-02-15");
    expect(addMonthsIso("2026-03-31", -1)).toBe("2026-02-28");
    expect(endOfMonthIso("2026-02-10")).toBe("2026-02-28");
  });

  it("finds week starts for either Sunday- or Monday-first calendars", () => {
    expect(weekdayOfIso("2026-09-21")).toBe(1); // Monday
    expect(startOfWeekIso("2026-09-23", 1)).toBe("2026-09-21");
    expect(startOfWeekIso("2026-09-23", 0)).toBe("2026-09-20");
    expect(startOfWeekIso("2026-09-20", 1)).toBe("2026-09-14");
  });

  it("formats without shifting the day", () => {
    expect(formatIsoDate("2026-09-21", "dd MMM yyyy")).toBe("21 Sep 2026");
  });
});

describe("local time ↔ UTC", () => {
  it("converts Dhaka (UTC+6, no DST) both ways", () => {
    const utc = localDateTimeToUtc("2026-09-21", "09:30", "Asia/Dhaka");
    expect(utc.toISOString()).toBe("2026-09-21T03:30:00.000Z");
    expect(utcToLocalParts(utc, "Asia/Dhaka")).toEqual({ iso: "2026-09-21", time: "09:30" });
  });

  it("handles daylight saving on both sides of the change", () => {
    // Los Angeles: PDT (UTC-7) in July, PST (UTC-8) in January.
    expect(localDateTimeToUtc("2026-07-01", "12:00", "America/Los_Angeles").toISOString()).toBe("2026-07-01T19:00:00.000Z");
    expect(localDateTimeToUtc("2026-01-15", "12:00", "America/Los_Angeles").toISOString()).toBe("2026-01-15T20:00:00.000Z");
  });

  it("keeps a late-evening event on the right local day", () => {
    const utc = localDateTimeToUtc("2026-09-21", "23:30", "Asia/Dhaka");
    expect(utc.toISOString()).toBe("2026-09-21T17:30:00.000Z");
    expect(utcToLocalParts(utc, "Asia/Dhaka").iso).toBe("2026-09-21");
  });
});

import { relativeDayLabel } from "./dates";
describe("relativeDayLabel", () => {
  it("uses friendly words near today and dates further away", () => {
    const t = "2026-09-21";
    expect(relativeDayLabel("2026-09-21", t)).toBe("Today");
    expect(relativeDayLabel("2026-09-22", t)).toBe("Tomorrow");
    expect(relativeDayLabel("2026-09-20", t)).toBe("Yesterday");
    expect(relativeDayLabel("2026-09-24", t)).toBe("Thu 24 Sep");
    expect(relativeDayLabel("2026-11-05", t)).toBe("5 Nov");
    expect(relativeDayLabel("2027-01-05", t, "dd MMM yyyy")).toBe("05 Jan 2027");
  });
});
