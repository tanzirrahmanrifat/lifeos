import { z } from "zod";
import { zCurrency, zIsoDate, zOptionalId, zOptionalText } from "@/lib/validation";

export const ACCOUNT_TYPES = ["CASH", "BANK", "SAVINGS", "WALLET", "CREDIT_CARD", "BUSINESS"] as const;
export const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "PAYPAL", "WISE", "STRIPE", "OTHER"] as const;
export const TXN_TYPES = ["INCOME", "EXPENSE"] as const;

/** A money field as the user typed it (e.g. "1,250.50"). Parsed and range-checked against the
 * record's actual currency in the service layer, where the currency is known. */
const zMoneyAmount = z.string().trim().min(1, "Enter an amount.");

export const accountInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Give the account a name.").max(60, "Use 60 characters or fewer."),
  type: z.enum(ACCOUNT_TYPES),
  currency: zCurrency,
  openingBalance: z.string().trim().default("0"),
  isSavings: z.boolean(),
});
export type AccountInput = z.output<typeof accountInputSchema>;
export type AccountFormValues = z.input<typeof accountInputSchema>;

export const transactionInputSchema = z.object({
  id: z.string().optional(),
  type: z.enum(TXN_TYPES),
  accountId: z.string().min(1, "Choose an account."),
  amount: zMoneyAmount,
  date: zIsoDate,
  categoryId: zOptionalId,
  vendor: zOptionalText(120),
  source: zOptionalText(120),
  notes: zOptionalText(1000),
});
export type TransactionInput = z.output<typeof transactionInputSchema>;
export type TransactionFormValues = z.input<typeof transactionInputSchema>;

export const transferInputSchema = z
  .object({
    id: z.string().optional(),
    fromAccountId: z.string().min(1, "Choose an account."),
    toAccountId: z.string().min(1, "Choose an account."),
    amountFrom: zMoneyAmount,
    amountTo: zMoneyAmount,
    date: zIsoDate,
    notes: zOptionalText(1000),
  })
  .refine((v) => v.fromAccountId !== v.toAccountId, { path: ["toAccountId"], message: "Choose two different accounts." });
export type TransferInput = z.output<typeof transferInputSchema>;
export type TransferFormValues = z.input<typeof transferInputSchema>;

export const budgetLineInputSchema = z.object({
  categoryId: z.string().min(1),
  amount: z.string().trim(),
});
export const budgetInputSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  incomeTarget: z.string().trim().default("0"),
  savingsTarget: z.string().trim().default("0"),
  expenseLines: z.array(budgetLineInputSchema).max(50),
});
export type BudgetInput = z.output<typeof budgetInputSchema>;

export const transactionListQuerySchema = z.object({
  type: z.enum(TXN_TYPES).optional().catch(undefined),
  accountId: z.string().max(60).optional().catch(undefined),
  categoryId: z.string().max(60).optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
  from: z.string().max(10).optional().catch(undefined),
  to: z.string().max(10).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type TransactionListQuery = z.output<typeof transactionListQuerySchema>;
