import type { Priority, TaskStatus } from "@/generated/prisma/enums";
import type { Recurrence } from "./recurrence";

export interface SubtaskDTO {
  id: string;
  title: string;
  done: boolean;
}

/** Plain, serialisable shape sent to the browser (dates are "yyyy-mm-dd" strings). */
export interface TaskDTO {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  tags: string[];
  notes: string | null;
  recurrence: Recurrence | null;
  subtasks: SubtaskDTO[];
  overdue: boolean;
}

export interface TaskListResult {
  items: TaskDTO[];
  total: number;
  page: number;
  pageSize: number;
  counts: { today: number; upcoming: number; overdue: number; completed: number };
}
