import { z } from "zod";
import { zOptionalId, zOptionalIsoDate, zOptionalText } from "@/lib/validation";

export const FIN_GOAL_STATUSES = ["ACTIVE", "ACHIEVED", "PAUSED", "CANCELLED"] as const;
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export const financialGoalInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Give the goal a name.").max(100, "Use 100 characters or fewer."),
  targetAmount: z.string().trim().min(1, "Enter a target amount."),
  targetDate: zOptionalIsoDate,
  categoryId: zOptionalId,
  priority: z.enum(PRIORITIES),
  status: z.enum(FIN_GOAL_STATUSES),
  notes: zOptionalText(2000),
});
export type FinancialGoalInput = z.output<typeof financialGoalInputSchema>;
export type FinancialGoalFormValues = z.input<typeof financialGoalInputSchema>;

export const contributionInputSchema = z.object({
  goalId: z.string().min(1),
  amount: z.string().trim().min(1, "Enter an amount."),
  date: z.string().trim(),
  sourceAccountId: zOptionalId,
  notes: zOptionalText(500),
});
export type ContributionInput = z.output<typeof contributionInputSchema>;
