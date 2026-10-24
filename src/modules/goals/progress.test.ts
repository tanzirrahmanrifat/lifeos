import { describe, expect, it } from "vitest";
import { clampPercent, computeGoalProgress } from "./progress";

describe("computeGoalProgress", () => {
  it("uses the share of completed milestones", () => {
    const ms = [{ done: true }, { done: true }, { done: false }, { done: false }, { done: false }];
    expect(computeGoalProgress("FROM_MILESTONES", 0, ms)).toBe(40);
  });
  it("is 0 with no milestones and 100 when all are done", () => {
    expect(computeGoalProgress("FROM_MILESTONES", 50, [])).toBe(0);
    expect(computeGoalProgress("FROM_MILESTONES", 0, [{ done: true }])).toBe(100);
  });
  it("uses the manual value in manual mode, clamped", () => {
    expect(computeGoalProgress("MANUAL", 65, [{ done: false }])).toBe(65);
    expect(computeGoalProgress("MANUAL", 140, [])).toBe(100);
    expect(computeGoalProgress("MANUAL", -5, [])).toBe(0);
    expect(clampPercent(33.4)).toBe(33);
  });
});
