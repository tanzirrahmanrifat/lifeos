import { describe, expect, it } from "vitest";
import { formatInvoiceNumber } from "./invoice-number";

describe("formatInvoiceNumber", () => {
  it("builds the default INV-YYYY-NNNN shape", () => {
    expect(formatInvoiceNumber({ prefix: "INV", includeYear: true, padding: 4 }, 2026, 1)).toBe("INV-2026-0001");
  });
  it("supports no year and custom padding", () => {
    expect(formatInvoiceNumber({ prefix: "WD", includeYear: false, padding: 3 }, 2026, 42)).toBe("WD-042");
  });
  it("never truncates numbers longer than the padding", () => {
    expect(formatInvoiceNumber({ prefix: "INV", includeYear: true, padding: 2 }, 2026, 12345)).toBe("INV-2026-12345");
  });
});
