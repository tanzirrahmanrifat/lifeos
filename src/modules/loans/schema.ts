import { z } from "zod";
import { zCurrency, zIsoDate, zOptionalId, zOptionalIsoDate, zOptionalPhone, zOptionalText } from "@/lib/validation";

export const LOAN_DIRECTIONS = ["LENT", "BORROWED"] as const;
export const LOAN_KINDS = ["STANDARD", "QARD_HASAN"] as const;
export const LOAN_STATUS_FILTERS = ["open", "closed", "all"] as const;

export const loanInputSchema = z.object({
  id: z.string().optional(),
  direction: z.enum(LOAN_DIRECTIONS),
  kind: z.enum(LOAN_KINDS),
  personName: z.string().trim().min(1, "Enter the person's name.").max(80, "Use 80 characters or fewer."),
  personPhone: zOptionalPhone,
  amount: z.string().trim().min(1, "Enter an amount."),
  currency: zCurrency,
  date: zIsoDate,
  dueDate: zOptionalIsoDate,
  accountId: zOptionalId,
  notes: zOptionalText(1000),
});
export type LoanInput = z.output<typeof loanInputSchema>;
export type LoanFormValues = z.input<typeof loanInputSchema>;

export const repaymentInputSchema = z.object({
  loanId: z.string().min(1),
  amount: z.string().trim().min(1, "Enter an amount."),
  date: zIsoDate,
  accountId: zOptionalId,
  notes: zOptionalText(500),
});
export type RepaymentInput = z.output<typeof repaymentInputSchema>;

export const forgiveInputSchema = z.object({
  loanId: z.string().min(1),
  /** Also log the waived amount on the Donations page (no money moves; it already left). */
  recordAsDonation: z.boolean(),
  donationCategoryId: zOptionalId,
});
export type ForgiveInput = z.output<typeof forgiveInputSchema>;

export const loanListQuerySchema = z.object({
  direction: z.enum(LOAN_DIRECTIONS).catch("LENT"),
  kind: z.enum(LOAN_KINDS).optional().catch(undefined),
  status: z.enum(LOAN_STATUS_FILTERS).catch("open"),
});
export type LoanListQuery = z.output<typeof loanListQuerySchema>;
