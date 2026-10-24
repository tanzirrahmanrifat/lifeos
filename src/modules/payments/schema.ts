import { z } from "zod";
import { zIsoDate, zOptionalText } from "@/lib/validation";

export const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "PAYPAL", "WISE", "STRIPE", "OTHER"] as const;

export const paymentInputSchema = z.object({
  invoiceId: z.string().min(1),
  accountId: z.string().min(1, "Choose an account."),
  amount: z.string().trim().min(1, "Enter an amount."),
  date: zIsoDate,
  method: z.enum(PAYMENT_METHODS),
  reference: zOptionalText(120),
  notes: zOptionalText(1000),
});
export type PaymentInput = z.output<typeof paymentInputSchema>;
export type PaymentFormValues = z.input<typeof paymentInputSchema>;
