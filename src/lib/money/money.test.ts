import { describe, expect, it } from "vitest";
import { Money, formatMoney, parseMoneyInput, divRound } from ".";

describe("Money basics", () => {
  it("represents $10.50 exactly and avoids float error", () => {
    const a = Money.fromMajorString("0.10", "USD");
    const b = Money.fromMajorString("0.20", "USD");
    expect(a.add(b).toMajorString()).toBe("0.30"); // 0.1 + 0.2 !== 0.3 in floats
    expect(Money.fromMajorString("10.50", "USD").minor).toBe(1050n);
  });

  it("respects currency exponents", () => {
    expect(Money.fromMajorString("500", "JPY").minor).toBe(500n);
    expect(Money.fromMajorString("1.234", "KWD").minor).toBe(1234n);
    expect(Money.of(1234n, "KWD").toMajorString()).toBe("1.234");
    expect(() => Money.fromMajorString("1.5", "JPY")).toThrow();
    expect(() => Money.fromMajorString("1.005", "USD")).toThrow();
    expect(Money.fromMajorString("1.500", "USD").minor).toBe(150n);
  });

  it("handles negatives and small values in toMajorString", () => {
    expect(Money.of(-5n, "USD").toMajorString()).toBe("-0.05");
    expect(Money.of(0n, "USD").toMajorString()).toBe("0.00");
  });

  it("refuses to mix currencies", () => {
    expect(() => Money.of(1n, "USD").add(Money.of(1n, "EUR"))).toThrow(/mismatch/);
  });

  it("round-trips through the DTO", () => {
    const m = Money.of(9007199254740993n, "BDT"); // beyond Number.MAX_SAFE_INTEGER
    expect(Money.fromDTO(m.toDTO()).equals(m)).toBe(true);
  });
});

describe("percentages and quantities", () => {
  it("applies tax in basis points with half-up rounding", () => {
    expect(Money.fromMajorString("1100", "USD").mulBps(1850).toMajorString()).toBe("203.50");
    expect(Money.of(5n, "USD").mulBps(1000).minor).toBe(1n); // 0.5 → 1
    expect(Money.of(-5n, "USD").mulBps(1000).minor).toBe(-1n); // half away from zero
  });

  it("multiplies by decimal quantities exactly", () => {
    expect(Money.fromMajorString("80", "USD").mulQuantity("1.5").toMajorString()).toBe("120.00");
    expect(Money.fromMajorString("33.33", "USD").mulQuantity("0.333").toMajorString()).toBe("11.10");
    expect(Money.fromMajorString("19.99", "USD").mulQuantity(3).toMajorString()).toBe("59.97");
  });

  it("supports banker's rounding when asked", () => {
    expect(divRound(25n, 10n, "half-even")).toBe(2n);
    expect(divRound(35n, 10n, "half-even")).toBe(4n);
    expect(divRound(25n, 10n, "half-up")).toBe(3n);
    expect(divRound(-11n, 10n, "floor")).toBe(-2n);
    expect(divRound(11n, 10n, "ceil")).toBe(2n);
  });
});

describe("allocate", () => {
  it("never loses a minor unit", () => {
    const parts = Money.fromMajorString("1.00", "USD").allocate([1, 1, 1]);
    expect(parts.map((p) => p.minor)).toEqual([34n, 33n, 33n]);
    expect(Money.sum(parts, "USD").minor).toBe(100n);
  });

  it("splits by weight and skips zero weights", () => {
    const parts = Money.of(1000n, "USD").allocate([70, 0, 30]);
    expect(parts.map((p) => p.minor)).toEqual([700n, 0n, 300n]);
  });
});

describe("parseMoneyInput", () => {
  it("accepts plain and grouped amounts", () => {
    const ok = (s: string, c = "USD") => {
      const r = parseMoneyInput(s, c);
      return r.ok ? r.money.minor : r;
    };
    expect(ok("1250.5")).toBe(125050n);
    expect(ok("1,250.50")).toBe(125050n);
    expect(ok("99")).toBe(9900n);
    expect(ok("0.5")).toBe(50n);
  });

  it("rejects ambiguous or over-precise input", () => {
    expect(parseMoneyInput("1.234,50", "USD")).toEqual({ ok: false, reason: "INVALID" });
    expect(parseMoneyInput("abc", "USD")).toEqual({ ok: false, reason: "INVALID" });
    expect(parseMoneyInput("", "USD")).toEqual({ ok: false, reason: "EMPTY" });
    expect(parseMoneyInput("1.005", "USD")).toEqual({ ok: false, reason: "TOO_MANY_DECIMALS" });
    expect(parseMoneyInput("1.50", "JPY")).toEqual({ ok: false, reason: "TOO_MANY_DECIMALS" });
  });
});

describe("formatMoney", () => {
  it("formats using the currency's own decimals", () => {
    expect(formatMoney(Money.of(110000n, "USD"))).toBe("$1,100.00");
    expect(formatMoney(Money.of(500n, "JPY"), { locale: "ja-JP" })).toMatch(/500/);
    expect(formatMoney(Money.of(1234n, "KWD"), { display: "code" })).toMatch(/1\.234/);
    expect(formatMoney(Money.of(-2550n, "USD"))).toBe("-$25.50");
  });

  it("does not lose precision on very large amounts", () => {
    const big = Money.of(123456789012345678n, "USD");
    expect(formatMoney(big)).toBe("$1,234,567,890,123,456.78");
  });
});
