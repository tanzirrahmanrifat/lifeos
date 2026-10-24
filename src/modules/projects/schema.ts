import { z } from "zod";
import { zOptionalIsoDate, zOptionalText } from "@/lib/validation";

export const PROJECT_STATUSES = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"] as const;

export const projectInputSchema = z.object({
  id: z.string().optional(),
  clientId: z.string().min(1, "Choose a client."),
  name: z.string().trim().min(1, "Give the project a name.").max(150, "Use 150 characters or fewer."),
  description: zOptionalText(2000),
  startDate: zOptionalIsoDate,
  deadline: zOptionalIsoDate,
  budget: z.string().trim().optional().default(""),
  currency: z.string().length(3),
  status: z.enum(PROJECT_STATUSES),
  progress: z.coerce.number().int().min(0).max(100).default(0),
  notes: zOptionalText(5000),
});
export type ProjectInput = z.output<typeof projectInputSchema>;
export type ProjectFormValues = z.input<typeof projectInputSchema>;

export const projectListQuerySchema = z.object({
  status: z.enum(PROJECT_STATUSES).optional().catch(undefined),
  clientId: z.string().max(60).optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type ProjectListQuery = z.output<typeof projectListQuerySchema>;
