import { currencyOrder } from "./currencies";
import { Money, type MoneyDTO } from "./money";

/**
 * Adds amounts per currency without ever converting between them. Zero totals are dropped, and the
 * result is ordered BDT, GBP, EUR first, then alphabetically.
 */
export function totalsByCurrency(values: Iterable<Money>): MoneyDTO[] {
  const byCode = new Map<string, Money>();
  for (const v of values) {
    const prev = byCode.get(v.currency);
    byCode.set(v.currency, prev ? prev.add(v) : v);
  }
  return [...byCode.values()]
    .filter((m) => !m.isZero())
    .sort((a, b) => currencyOrder(a.currency, b.currency))
    .map((m) => m.toDTO());
}
