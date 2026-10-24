import { z } from "zod";
import { zClockTime, zHexColor, zIsoDate, zOptionalId, zOptionalIsoDate, zOptionalText } from "@/lib/validation";

export const FREQUENCIES = ["DAILY", "WEEKDAYS", "WEEKLY", "MONTHLY"] as const;
export const HABIT_ICONS = ["check", "dumbbell", "book", "brain", "droplet", "sun", "moon", "pencil", "heart", "coffee", "music", "leaf"] as const;
export const HABIT_COLORS = ["#0e6b5c", "#2a5cab", "#7a4fb5", "#b92f1c", "#a35a07", "#4d7c0f", "#be185d", "#0e7490"] as const;

export const habitInputSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1, "Give the habit a name.").max(80, "Use 80 characters or fewer."),
    description: zOptionalText(500),
    frequency: z.enum(FREQUENCIES),
    weekdays: z.array(z.coerce.number().int().min(0).max(6)).max(7),
    targetPerPeriod: z.coerce.number().int("Enter a whole number.").min(1, "Use 1 or more.").max(31, "Use 31 or fewer."),
    startDate: zIsoDate,
    endDate: zOptionalIsoDate,
    reminderTime: zClockTime,
    categoryId: zOptionalId,
    color: zHexColor,
    icon: z.enum(HABIT_ICONS),
  })
  .refine((v) => v.frequency !== "WEEKDAYS" || v.weekdays.length > 0, { path: ["weekdays"], message: "Pick at least one day." })
  .refine((v) => v.frequency !== "WEEKLY" || v.targetPerPeriod <= 7, { path: ["targetPerPeriod"], message: "A week has 7 days — use 7 or fewer." })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, { path: ["endDate"], message: "The end date can't be before the start date." });

export type HabitInput = z.output<typeof habitInputSchema>;
export type HabitFormValues = z.input<typeof habitInputSchema>;

export const habitLogSchema = z.object({ habitId: z.string().min(1), date: zIsoDate });
export const monthParamSchema = z.string().regex(/^\d{4}-\d{2}$/).catch("");
