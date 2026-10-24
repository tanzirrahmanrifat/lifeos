import { getCurrency } from "./currencies";
import type { Money } from "./money";

export interface FormatOptions {
  locale?: string;
  /** "narrowSymbol" → ৳1,050.00 (default), "symbol" → BDT 1,050.00 in some locales, "code" → USD 1,050.00 */
  display?: "symbol" | "code" | "narrowSymbol";
  /** Hide decimals for large dashboard figures. */
  compact?: boolean;
  signDisplay?: "auto" | "always" | "exceptZero" | "never";
}

/**
 * Locale-aware formatting. The exact decimal *string* is handed to Intl, so large or fractional
 * values are never routed through a float.
 */
export function formatMoney(money: Money, opts: FormatOptions = {}): string {
  const { locale = "en-US", display = "narrowSymbol", compact = false, signDisplay = "auto" } = opts;
  const { exponent } = getCurrency(money.currency);
  const nf = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: money.currency,
    currencyDisplay: display,
    signDisplay,
    minimumFractionDigits: compact ? 0 : exponent,
    maximumFractionDigits: compact ? 0 : exponent,
  });
  return nf.format(money.toMajorString() as unknown as number);
}
