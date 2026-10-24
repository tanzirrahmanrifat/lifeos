import { getCurrency } from "./currencies";
import { parseDecimal, pow10 } from "./decimal";
import { divRound, type RoundingMode } from "./rounding";

export interface MoneyDTO {
  /** Minor units as a string (safe to serialise; BigInt is not JSON-friendly). */
  minor: string;
  currency: string;
}

/**
 * Immutable money value: integer minor units + currency. Arithmetic across currencies throws —
 * conversion must be explicit and always goes through a recorded FX rate.
 */
export class Money {
  private constructor(
    readonly minor: bigint,
    readonly currency: string,
  ) {}

  static of(minor: bigint | number | string, currency: string): Money {
    getCurrency(currency); // validates the code
    if (typeof minor === "number" && !Number.isSafeInteger(minor)) {
      throw new RangeError("Money.of: number must be a safe integer of minor units");
    }
    return new Money(BigInt(minor), currency);
  }

  static zero(currency: string): Money {
    return Money.of(0n, currency);
  }

  static fromDTO(dto: MoneyDTO): Money {
    return Money.of(BigInt(dto.minor), dto.currency);
  }

  /** Builds money from a decimal *string* in major units, e.g. "10.50". Rejects extra precision. */
  static fromMajorString(amount: string, currency: string): Money {
    const { exponent } = getCurrency(currency);
    const { value, scale } = parseDecimal(amount);
    if (scale > exponent) {
      // Allow trailing zeros ("10.500" for a 2-dp currency) but never silently drop real digits.
      const factor = pow10(scale - exponent);
      if (value % factor !== 0n) throw new RangeError(`${currency} allows at most ${exponent} decimal places`);
      return new Money(value / factor, currency);
    }
    return new Money(value * pow10(exponent - scale), currency);
  }

  toDTO(): MoneyDTO {
    return { minor: this.minor.toString(), currency: this.currency };
  }

  /** Exact major-unit decimal string, e.g. 1050n USD → "10.50". */
  toMajorString(): string {
    const { exponent } = getCurrency(this.currency);
    const negative = this.minor < 0n;
    const abs = (negative ? -this.minor : this.minor).toString().padStart(exponent + 1, "0");
    const whole = exponent === 0 ? abs : abs.slice(0, -exponent);
    const frac = exponent === 0 ? "" : abs.slice(-exponent);
    return `${negative ? "-" : ""}${whole}${exponent ? "." + frac : ""}`;
  }

  private assertSame(other: Money) {
    if (other.currency !== this.currency) {
      throw new TypeError(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }

  add(other: Money): Money {
    this.assertSame(other);
    return new Money(this.minor + other.minor, this.currency);
  }
  sub(other: Money): Money {
    this.assertSame(other);
    return new Money(this.minor - other.minor, this.currency);
  }
  negate(): Money {
    return new Money(-this.minor, this.currency);
  }
  abs(): Money {
    return this.minor < 0n ? this.negate() : this;
  }
  compare(other: Money): -1 | 0 | 1 {
    this.assertSame(other);
    return this.minor === other.minor ? 0 : this.minor < other.minor ? -1 : 1;
  }
  equals(other: Money): boolean {
    return other.currency === this.currency && other.minor === this.minor;
  }
  isZero = () => this.minor === 0n;
  isPositive = () => this.minor > 0n;
  isNegative = () => this.minor < 0n;

  /** Multiplies by a rate in basis points (1 bp = 0.01%). Used for tax and percentage discounts. */
  mulBps(bps: number, mode: RoundingMode = "half-up"): Money {
    if (!Number.isInteger(bps)) throw new RangeError("bps must be an integer");
    return new Money(divRound(this.minor * BigInt(bps), 10000n, mode), this.currency);
  }

  /** Multiplies by an exact decimal quantity (string preferred), rounding once at the end. */
  mulQuantity(quantity: string | number, mode: RoundingMode = "half-up"): Money {
    const { value, scale } = parseDecimal(quantity);
    return new Money(divRound(this.minor * value, pow10(scale), mode), this.currency);
  }

  /**
   * Splits the amount by integer weights without losing a single minor unit (largest-remainder,
   * leftover units go to the earliest parts). e.g. $1.00 split 1:1:1 → 34¢, 33¢, 33¢.
   */
  allocate(weights: number[]): Money[] {
    if (weights.length === 0 || weights.some((w) => !Number.isInteger(w) || w < 0)) {
      throw new RangeError("allocate: weights must be non-negative integers");
    }
    const total = weights.reduce((a, b) => a + BigInt(b), 0n);
    if (total === 0n) throw new RangeError("allocate: weights sum to zero");
    const negative = this.minor < 0n;
    const abs = negative ? -this.minor : this.minor;
    const parts = weights.map((w) => (abs * BigInt(w)) / total);
    let remainder = abs - parts.reduce((a, b) => a + b, 0n);
    for (let i = 0; remainder > 0n; i = (i + 1) % parts.length) {
      if (weights[i] !== 0) {
        parts[i] = (parts[i] as bigint) + 1n;
        remainder -= 1n;
      }
    }
    return parts.map((p) => new Money(negative ? -p : p, this.currency));
  }

  static sum(values: Money[], currency: string): Money {
    return values.reduce((acc, v) => acc.add(v), Money.zero(currency));
  }
}
