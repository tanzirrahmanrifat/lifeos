import type { ProjectStatus } from "@/generated/prisma/enums";
import type { MoneyDTO } from "@/lib/money";

export interface ProjectDTO {
  id: string;
  name: string;
  description: string | null;
  clientId: string;
  clientName: string;
  startDate: string | null;
  deadline: string | null;
  budget: MoneyDTO | null;
  status: ProjectStatus;
  progress: number;
  notes: string | null;
  revenue: MoneyDTO;
  expenses: MoneyDTO;
  taskCount: number;
  openTaskCount: number;
  overdue: boolean;
}

export interface ProjectListResult {
  items: ProjectDTO[];
  total: number;
  page: number;
  pageSize: number;
}
