import { CURRENCIES, PINNED_CURRENCY_CODES } from "@/lib/money";

const pinned = PINNED_CURRENCY_CODES.map((code) => CURRENCIES.find((c) => c.code === code)!);
const others = CURRENCIES.filter((c) => !(PINNED_CURRENCY_CODES as readonly string[]).includes(c.code));

/** <option>s for a currency <select>: BDT, GBP and EUR first, then every other supported currency. */
export function CurrencyOptions() {
  return (
    <>
      <optgroup label="Main">
        {pinned.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} ({c.symbol}) — {c.name}
          </option>
        ))}
      </optgroup>
      <optgroup label="Other currencies">
        {others.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} — {c.name}
          </option>
        ))}
      </optgroup>
    </>
  );
}
