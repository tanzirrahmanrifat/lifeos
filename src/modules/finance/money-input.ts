import { Money, parseMoneyInput } from "@/lib/money";
import { validationError } from "@/lib/errors";

/** Parses a user-typed amount against a known currency, or throws a friendly validation error. */
export function requireMoney(input: string, currency: string, field = "amount"): Money {
  const result = parseMoneyInput(input, currency);
  if (result.ok) return result.money;
  const messages = {
    EMPTY: "Enter an amount.",
    INVALID: "Enter a valid amount, e.g. 1250.50.",
    TOO_MANY_DECIMALS: `${currency} doesn't use that many decimal places.`,
  } as const;
  throw validationError(messages[result.reason], { [field]: [messages[result.reason]] });
}

/** Same, but zero is also rejected (most money fields must be positive). */
export function requirePositiveMoney(input: string, currency: string, field = "amount"): Money {
  const money = requireMoney(input, currency, field);
  if (!money.isPositive()) throw validationError("Enter an amount greater than zero.", { [field]: ["Enter an amount greater than zero."] });
  return money;
}
