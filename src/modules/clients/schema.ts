import { z } from "zod";
import { zOptionalEmail, zOptionalPhone, zOptionalText, zOptionalUrl } from "@/lib/validation";

export const CLIENT_STATUSES = ["LEAD", "ACTIVE", "INACTIVE", "COMPLETED"] as const;

export const clientInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Enter a name.").max(120, "Use 120 characters or fewer."),
  company: zOptionalText(120),
  email: zOptionalEmail,
  phone: zOptionalPhone,
  website: zOptionalUrl,
  address: zOptionalText(500),
  country: zOptionalText(80),
  status: z.enum(CLIENT_STATUSES),
  notes: zOptionalText(5000),
});
export type ClientInput = z.output<typeof clientInputSchema>;
export type ClientFormValues = z.input<typeof clientInputSchema>;

export const clientListQuerySchema = z.object({
  status: z.enum(CLIENT_STATUSES).optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type ClientListQuery = z.output<typeof clientListQuerySchema>;
