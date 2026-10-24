/** Exact decimal parsing for quantities and rates — no floating point anywhere. */
export interface ScaledInt {
  /** Integer value, i.e. decimal × 10^scale. */
  value: bigint;
  scale: number;
}

const DECIMAL = /^[+-]?\d+(\.\d+)?$/;

export function parseDecimal(input: string | number): ScaledInt {
  const s = typeof input === "number" ? numberToPlainString(input) : input.trim();
  if (!DECIMAL.test(s)) throw new RangeError(`Invalid decimal: "${input}"`);
  const negative = s.startsWith("-");
  const unsigned = s.replace(/^[+-]/, "");
  const [whole = "0", frac = ""] = unsigned.split(".");
  const value = BigInt(whole + frac);
  return { value: negative ? -value : value, scale: frac.length };
}

function numberToPlainString(n: number): string {
  if (!Number.isFinite(n)) throw new RangeError("Invalid decimal: not finite");
  // toString may use exponent notation for very small/large values; toFixed(20) avoids it.
  const s = String(n);
  return /e/i.test(s) ? n.toFixed(20).replace(/\.?0+$/, "") : s;
}

export function pow10(exp: number): bigint {
  return 10n ** BigInt(exp);
}
