import { z } from "zod";
import { zOptionalId, zOptionalIsoDate, zOptionalText } from "@/lib/validation";

export const GOAL_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "ON_HOLD", "CANCELLED"] as const;

export const milestoneInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Enter a milestone.").max(200, "Use 200 characters or fewer."),
  dueDate: zOptionalIsoDate,
  done: z.boolean(),
});

export const goalInputSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1, "Give the goal a name.").max(120, "Use 120 characters or fewer."),
    description: zOptionalText(2000),
    categoryId: zOptionalId,
    startDate: zOptionalIsoDate,
    targetDate: zOptionalIsoDate,
    status: z.enum(GOAL_STATUSES),
    progressMode: z.enum(["FROM_MILESTONES", "MANUAL"]),
    progress: z.coerce.number().int("Enter a whole number.").min(0, "Use 0–100.").max(100, "Use 0–100."),
    notes: zOptionalText(5000),
    milestones: z.array(milestoneInputSchema).max(50, "Use 50 milestones or fewer."),
  })
  .refine((v) => !v.startDate || !v.targetDate || v.startDate <= v.targetDate, {
    path: ["targetDate"],
    message: "The target date can't be before the start date.",
  });

export type GoalInput = z.output<typeof goalInputSchema>;
export type GoalFormValues = z.input<typeof goalInputSchema>;
