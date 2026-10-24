import { describe, expect, it } from "vitest";
import { describeRecurrence, nextOccurrence, parseRecurrence, ruleFromForm, ruleToForm } from "./recurrence";

describe("recurrence", () => {
  it("computes the next due date for each frequency", () => {
    expect(nextOccurrence("2026-09-21", { freq: "DAILY", interval: 1 })).toBe("2026-09-22");
    expect(nextOccurrence("2026-09-21", { freq: "DAILY", interval: 3 })).toBe("2026-09-24");
    expect(nextOccurrence("2026-09-21", { freq: "WEEKLY", interval: 1 })).toBe("2026-09-28");
    expect(nextOccurrence("2026-09-21", { freq: "WEEKLY", interval: 2 })).toBe("2026-10-05");
    expect(nextOccurrence("2026-01-31", { freq: "MONTHLY", interval: 1 })).toBe("2026-02-28");
    expect(nextOccurrence("2026-12-15", { freq: "MONTHLY", interval: 2 })).toBe("2027-02-15");
  });

  it("maps form choices to rules and back", () => {
    expect(ruleFromForm("NONE", 1, "DAYS")).toBeNull();
    expect(ruleFromForm("WEEKLY", 5, "DAYS")).toEqual({ freq: "WEEKLY", interval: 1 });
    expect(ruleFromForm("CUSTOM", 3, "WEEKS")).toEqual({ freq: "WEEKLY", interval: 3 });
    expect(ruleToForm({ freq: "MONTHLY", interval: 1 })).toEqual({ repeat: "MONTHLY", repeatInterval: 1, repeatUnit: "MONTHS" });
    expect(ruleToForm({ freq: "DAILY", interval: 4 })).toEqual({ repeat: "CUSTOM", repeatInterval: 4, repeatUnit: "DAYS" });
    expect(ruleToForm(null).repeat).toBe("NONE");
  });

  it("treats malformed stored rules as 'does not repeat'", () => {
    expect(parseRecurrence(null)).toBeNull();
    expect(parseRecurrence({ freq: "YEARLY", interval: 1 })).toBeNull();
    expect(parseRecurrence({ freq: "DAILY", interval: 0 })).toBeNull();
    expect(parseRecurrence({ freq: "DAILY", interval: 2 })).toEqual({ freq: "DAILY", interval: 2 });
  });

  it("describes rules in plain words", () => {
    expect(describeRecurrence({ freq: "DAILY", interval: 1 })).toBe("Every day");
    expect(describeRecurrence({ freq: "WEEKLY", interval: 2 })).toBe("Every 2 weeks");
  });
});
