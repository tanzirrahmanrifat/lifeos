export type RoundingMode = "half-up" | "half-even" | "floor" | "ceil" | "down";

/**
 * Integer division `n / d` (d > 0) with an explicit rounding rule.
 * "half-up" rounds .5 away from zero (the invoice default); "half-even" is banker's rounding.
 */
export function divRound(n: bigint, d: bigint, mode: RoundingMode = "half-up"): bigint {
  if (d <= 0n) throw new RangeError("divRound: divisor must be positive");
  const negative = n < 0n;
  const abs = negative ? -n : n;
  let q = abs / d;
  const r = abs % d;

  if (r !== 0n) {
    const twice = r * 2n;
    switch (mode) {
      case "half-up":
        if (twice >= d) q += 1n;
        break;
      case "half-even":
        if (twice > d || (twice === d && q % 2n === 1n)) q += 1n;
        break;
      case "down":
        break;
      case "floor":
        if (negative) q += 1n;
        break;
      case "ceil":
        if (!negative) q += 1n;
        break;
    }
  }
  return negative ? -q : q;
}
