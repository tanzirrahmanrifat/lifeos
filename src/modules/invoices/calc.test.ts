import { describe, expect, it } from "vitest";
import { calcInvoice } from "./calc";

describe("calcInvoice", () => {
  it("matches the worked example from the spec", () => {
    const c = calcInvoice(
      [
        { description: "WordPress Development", quantity: "1", rate: "800", discountPercent: 0, taxPercent: 0 },
        { description: "SEO Setup", quantity: "1", rate: "300", discountPercent: 0, taxPercent: 0 },
      ],
      "USD",
    );
    expect(c.totalMinor).toBe(110000n); // $1,100.00
  });

  it("applies per-line discount then tax, and the totals always add up exactly", () => {
    const c = calcInvoice(
      [
        { description: "A", quantity: "3", rate: "19.99", discountPercent: 1000, taxPercent: 1850 }, // 10% off, 18.5% tax
        { description: "B", quantity: "2.5", rate: "40", discountPercent: 0, taxPercent: 500 },
      ],
      "USD",
    );
    expect(c.subtotalMinor - c.discountMinor + c.taxMinor).toBe(c.totalMinor);
    expect(c.lines[0]!.baseMinor).toBe(5997n); // 3 × 19.99
    expect(c.lines[0]!.discountMinor).toBe(600n); // 10% of 59.97 = 5.997 → 6.00 half-up
  });

  it("handles a currency with 0 decimal places without drift", () => {
    const c = calcInvoice([{ description: "X", quantity: "7", rate: "1000", discountPercent: 0, taxPercent: 0 }], "JPY");
    expect(c.totalMinor).toBe(7000n);
  });

  it("rounds zero lines to zero without throwing", () => {
    const c = calcInvoice([{ description: "Free", quantity: "1", rate: "0", discountPercent: 0, taxPercent: 0 }], "USD");
    expect(c.totalMinor).toBe(0n);
  });
});
