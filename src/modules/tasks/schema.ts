import { z } from "zod";
import { zOptionalId, zOptionalIsoDate, zOptionalText, zTagList } from "@/lib/validation";

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const TASK_VIEWS = ["today", "upcoming", "all", "completed", "overdue"] as const;
export const TASK_SORTS = ["due", "priority", "created", "title"] as const;

export const subtaskInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Enter a subtask.").max(200, "Use 200 characters or fewer."),
  done: z.boolean(),
});

export const taskInputSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().trim().min(1, "Enter a title.").max(200, "Use 200 characters or fewer."),
    description: zOptionalText(5000),
    status: z.enum(TASK_STATUSES),
    priority: z.enum(PRIORITIES),
    startDate: zOptionalIsoDate,
    dueDate: zOptionalIsoDate,
    categoryId: zOptionalId,
    projectId: zOptionalId,
    tags: zTagList,
    repeat: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY", "CUSTOM"]),
    repeatInterval: z.coerce.number().int("Enter a whole number.").min(1, "Use 1 or more.").max(365, "Use 365 or fewer."),
    repeatUnit: z.enum(["DAYS", "WEEKS", "MONTHS"]),
    notes: zOptionalText(5000),
    subtasks: z.array(subtaskInputSchema).max(50, "Use 50 subtasks or fewer."),
  })
  .refine((v) => !v.startDate || !v.dueDate || v.startDate <= v.dueDate, {
    path: ["dueDate"],
    message: "The due date can't be before the start date.",
  })
  .refine((v) => v.repeat === "NONE" || v.dueDate !== null, {
    path: ["dueDate"],
    message: "Set a due date so we know when the next one is due.",
  });

export type TaskInput = z.output<typeof taskInputSchema>;
export type TaskFormValues = z.input<typeof taskInputSchema>;

export const taskListQuerySchema = z.object({
  view: z.enum(TASK_VIEWS).catch("today"),
  status: z.enum(TASK_STATUSES).optional().catch(undefined),
  priority: z.enum(PRIORITIES).optional().catch(undefined),
  categoryId: z.string().max(60).optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
  sort: z.enum(TASK_SORTS).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type TaskListQuery = z.output<typeof taskListQuerySchema>;
