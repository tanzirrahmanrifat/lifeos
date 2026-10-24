import { getCurrency } from "./currencies";
import { Money } from "./money";

export type ParseResult =
  | { ok: true; money: Money }
  | { ok: false; reason: "EMPTY" | "INVALID" | "TOO_MANY_DECIMALS" };

const GROUPED = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/;
const PLAIN = /^-?\d+(\.\d+)?$/;

/**
 * Parses user-typed amounts ("1,250.50", "99", "0.5"). Strict on purpose: no rounding, no guessing
 * at locale separators. "1.234,50" is rejected rather than misread.
 */
export function parseMoneyInput(input: string, currency: string): ParseResult {
  const s = input.trim();
  if (!s) return { ok: false, reason: "EMPTY" };
  if (!GROUPED.test(s) && !PLAIN.test(s)) return { ok: false, reason: "INVALID" };
  const cleaned = s.replaceAll(",", "");
  const frac = cleaned.split(".")[1] ?? "";
  const { exponent } = getCurrency(currency);
  if (frac.replace(/0+$/, "").length > exponent) return { ok: false, reason: "TOO_MANY_DECIMALS" };
  return { ok: true, money: Money.fromMajorString(cleaned, currency) };
}
