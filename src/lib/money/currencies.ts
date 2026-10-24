/**
 * Currency catalogue. `exponent` is the ISO 4217 minor-unit exponent (USD 2, JPY 0, KWD 3), so no
 * code path ever assumes two decimal places.
 */
export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  exponent: number;
}

const list: CurrencyInfo[] = [
  { code: "USD", name: "US Dollar", symbol: "$", exponent: 2 },
  { code: "EUR", name: "Euro", symbol: "€", exponent: 2 },
  { code: "GBP", name: "British Pound", symbol: "£", exponent: 2 },
  { code: "BDT", name: "Bangladeshi Taka", symbol: "৳", exponent: 2 },
  { code: "INR", name: "Indian Rupee", symbol: "₹", exponent: 2 },
  { code: "PKR", name: "Pakistani Rupee", symbol: "₨", exponent: 2 },
  { code: "LKR", name: "Sri Lankan Rupee", symbol: "Rs", exponent: 2 },
  { code: "NPR", name: "Nepalese Rupee", symbol: "Rs", exponent: 2 },
  { code: "AED", name: "UAE Dirham", symbol: "AED", exponent: 2 },
  { code: "SAR", name: "Saudi Riyal", symbol: "SAR", exponent: 2 },
  { code: "QAR", name: "Qatari Riyal", symbol: "QAR", exponent: 2 },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "KWD", exponent: 3 },
  { code: "BHD", name: "Bahraini Dinar", symbol: "BHD", exponent: 3 },
  { code: "OMR", name: "Omani Rial", symbol: "OMR", exponent: 3 },
  { code: "CAD", name: "Canadian Dollar", symbol: "$", exponent: 2 },
  { code: "AUD", name: "Australian Dollar", symbol: "$", exponent: 2 },
  { code: "NZD", name: "New Zealand Dollar", symbol: "$", exponent: 2 },
  { code: "SGD", name: "Singapore Dollar", symbol: "$", exponent: 2 },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "$", exponent: 2 },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", exponent: 2 },
  { code: "THB", name: "Thai Baht", symbol: "฿", exponent: 2 },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", exponent: 2 },
  { code: "PHP", name: "Philippine Peso", symbol: "₱", exponent: 2 },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫", exponent: 0 },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", exponent: 0 },
  { code: "KRW", name: "South Korean Won", symbol: "₩", exponent: 0 },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", exponent: 2 },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", exponent: 2 },
  { code: "SEK", name: "Swedish Krona", symbol: "kr", exponent: 2 },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr", exponent: 2 },
  { code: "DKK", name: "Danish Krone", symbol: "kr", exponent: 2 },
  { code: "PLN", name: "Polish Złoty", symbol: "zł", exponent: 2 },
  { code: "TRY", name: "Turkish Lira", symbol: "₺", exponent: 2 },
  { code: "ILS", name: "Israeli Shekel", symbol: "₪", exponent: 2 },
  { code: "EGP", name: "Egyptian Pound", symbol: "E£", exponent: 2 },
  { code: "ZAR", name: "South African Rand", symbol: "R", exponent: 2 },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", exponent: 2 },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh", exponent: 2 },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", exponent: 2 },
  { code: "MXN", name: "Mexican Peso", symbol: "$", exponent: 2 },
];

export const CURRENCIES: readonly CurrencyInfo[] = list;
export const CURRENCY_CODES = list.map((c) => c.code) as [string, ...string[]];

const byCode = new Map(list.map((c) => [c.code, c]));

export function isCurrencyCode(code: string): boolean {
  return byCode.has(code);
}

export function getCurrency(code: string): CurrencyInfo {
  const c = byCode.get(code);
  if (!c) throw new Error(`Unsupported currency: ${code}`);
  return c;
}
