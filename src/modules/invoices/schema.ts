import { z } from "zod";
import { zIsoDate, zOptionalId, zOptionalText, zPercentToBps } from "@/lib/validation";

export const INVOICE_STATUSES = ["DRAFT", "SENT", "VIEWED", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"] as const;

export const invoiceItemInputSchema = z.object({
  id: z.string().optional(),
  description: z.string().trim().min(1, "Enter a description.").max(300, "Use 300 characters or fewer."),
  quantity: z.string().trim().min(1, "Enter a quantity.").default("1"),
  rate: z.string().trim().min(1, "Enter a rate."),
  discountPercent: zPercentToBps,
  taxPercent: zPercentToBps,
});
export type InvoiceItemInput = z.output<typeof invoiceItemInputSchema>;

export const invoiceInputSchema = z
  .object({
    id: z.string().optional(),
    clientId: z.string().min(1, "Choose a client."),
    projectId: zOptionalId,
    issueDate: zIsoDate,
    dueDate: zIsoDate,
    currency: z.string().length(3),
    notes: zOptionalText(2000),
    paymentTerms: zOptionalText(500),
    items: z.array(invoiceItemInputSchema).min(1, "Add at least one line item."),
  })
  .refine((v) => v.dueDate >= v.issueDate, { path: ["dueDate"], message: "The due date can't be before the issue date." });
export type InvoiceInput = z.output<typeof invoiceInputSchema>;
export type InvoiceFormValues = z.input<typeof invoiceInputSchema>;

export const invoiceListQuerySchema = z.object({
  status: z.enum(INVOICE_STATUSES).optional().catch(undefined),
  clientId: z.string().max(60).optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type InvoiceListQuery = z.output<typeof invoiceListQuerySchema>;
