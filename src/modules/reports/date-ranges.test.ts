import { describe, expect, it } from "vitest";
import { resolveRange } from "./date-ranges";

describe("resolveRange", () => {
  const today = "2026-09-23"; // Wednesday

  it("resolves today, this week (Monday start) and this month", () => {
    expect(resolveRange("today", today, 1)).toMatchObject({ from: today, to: today });
    expect(resolveRange("this_week", today, 1)).toMatchObject({ from: "2026-09-21", to: today });
    expect(resolveRange("this_month", today, 1)).toMatchObject({ from: "2026-09-01", to: today });
  });

  it("resolves last month fully, regardless of today's date within this month", () => {
    expect(resolveRange("last_month", today, 1)).toMatchObject({ from: "2026-08-01", to: "2026-08-31" });
  });

  it("resolves this year and a custom range", () => {
    expect(resolveRange("this_year", today, 1)).toMatchObject({ from: "2026-01-01", to: today });
    expect(resolveRange("custom", today, 1, { from: "2026-01-15", to: "2026-02-15" })).toMatchObject({ from: "2026-01-15", to: "2026-02-15" });
  });

  it("falls back to today when a custom range is missing bounds", () => {
    expect(resolveRange("custom", today, 1, {})).toMatchObject({ from: today, to: today });
  });
});
