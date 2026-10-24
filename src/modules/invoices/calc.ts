import { Money } from "@/lib/money";
import type { InvoiceItemInput } from "./schema";

export interface LineCalc {
  description: string;
  quantity: string;
  rateMinor: bigint;
  discountBps: number;
  taxBps: number;
  lineTotalMinor: bigint;
  /** Base (quantity × rate) before discount/tax — used for the subtotal and to derive the discount amount. */
  baseMinor: bigint;
  discountMinor: bigint;
  taxMinor: bigint;
}

export interface InvoiceCalc {
  lines: LineCalc[];
  subtotalMinor: bigint;
  discountMinor: bigint;
  taxMinor: bigint;
  totalMinor: bigint;
}

/**
 * One rounding per line (half-up), then everything else is an exact sum of those already-rounded
 * pieces — so subtotal − discount + tax always equals the total exactly, on screen, in the database,
 * and on the PDF.
 */
export function calcInvoice(items: InvoiceItemInput[], currency: string): InvoiceCalc {
  const lines = items.map((item): LineCalc => {
    const rate = Money.fromMajorString(item.rate, currency);
    const base = rate.mulQuantity(item.quantity);
    const discount = base.mulBps(item.discountPercent || 0);
    const afterDiscount = base.sub(discount);
    const tax = afterDiscount.mulBps(item.taxPercent || 0);
    const total = afterDiscount.add(tax);
    return {
      description: item.description,
      quantity: item.quantity,
      rateMinor: rate.minor,
      discountBps: item.discountPercent || 0,
      taxBps: item.taxPercent || 0,
      lineTotalMinor: total.minor,
      baseMinor: base.minor,
      discountMinor: discount.minor,
      taxMinor: tax.minor,
    };
  });
  return {
    lines,
    subtotalMinor: lines.reduce((s, l) => s + l.baseMinor, 0n),
    discountMinor: lines.reduce((s, l) => s + l.discountMinor, 0n),
    taxMinor: lines.reduce((s, l) => s + l.taxMinor, 0n),
    totalMinor: lines.reduce((s, l) => s + l.lineTotalMinor, 0n),
  };
}
