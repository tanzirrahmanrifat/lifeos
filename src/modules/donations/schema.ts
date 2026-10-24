import { z } from "zod";
import { zCurrency, zIsoDate, zOptionalId, zOptionalText } from "@/lib/validation";

export const donationInputSchema = z.object({
  id: z.string().optional(),
  recipient: zOptionalText(120),
  categoryId: zOptionalId,
  amount: z.string().trim().min(1, "Enter an amount."),
  currency: zCurrency,
  date: zIsoDate,
  accountId: zOptionalId,
  notes: zOptionalText(1000),
});
export type DonationInput = z.output<typeof donationInputSchema>;
export type DonationFormValues = z.input<typeof donationInputSchema>;

export const donationListQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional().catch(undefined),
  categoryId: z.string().max(60).optional().catch(undefined),
});
export type DonationListQuery = z.output<typeof donationListQuerySchema>;
