import type { GoalStatus } from "@/generated/prisma/enums";

export interface MilestoneDTO {
  id: string;
  title: string;
  dueDate: string | null;
  done: boolean;
}

export interface GoalDTO {
  id: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  startDate: string | null;
  targetDate: string | null;
  status: GoalStatus;
  progressMode: "FROM_MILESTONES" | "MANUAL";
  progress: number;
  notes: string | null;
  milestones: MilestoneDTO[];
  overdue: boolean;
  daysLeft: number | null;
}
