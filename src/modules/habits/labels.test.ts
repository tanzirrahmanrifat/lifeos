import { describe, expect, it } from "vitest";
import { describeFrequency } from "./labels";

describe("describeFrequency", () => {
  it("reads naturally", () => {
    expect(describeFrequency({ frequency: "DAILY", weekdays: [], targetPerPeriod: 1 })).toBe("Every day");
    expect(describeFrequency({ frequency: "WEEKDAYS", weekdays: [1, 2, 3, 4, 5], targetPerPeriod: 1 })).toBe("Weekdays");
    expect(describeFrequency({ frequency: "WEEKDAYS", weekdays: [0, 6], targetPerPeriod: 1 })).toBe("Weekends");
    expect(describeFrequency({ frequency: "WEEKDAYS", weekdays: [5, 1, 3], targetPerPeriod: 1 })).toBe("Mon, Wed, Fri");
    expect(describeFrequency({ frequency: "WEEKLY", weekdays: [], targetPerPeriod: 3 })).toBe("3× a week");
    expect(describeFrequency({ frequency: "MONTHLY", weekdays: [], targetPerPeriod: 2 })).toBe("2× a month");
  });
});
