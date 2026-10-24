import type { FinancialGoalStatus, Priority } from "@/generated/prisma/enums";
import type { MoneyDTO } from "@/lib/money";

export interface ContributionDTO {
  id: string;
  amount: MoneyDTO;
  date: string;
  sourceAccountId: string | null;
  sourceAccountName: string | null;
  notes: string | null;
}

export interface FinancialGoalDTO {
  id: string;
  name: string;
  target: MoneyDTO;
  current: MoneyDTO;
  remaining: MoneyDTO;
  progressPct: number;
  targetDate: string | null;
  categoryId: string | null;
  categoryName: string | null;
  priority: Priority;
  status: FinancialGoalStatus;
  notes: string | null;
  /** How much per month is needed to reach the target by its date, or null (no date, or already met). */
  requiredMonthly: MoneyDTO | null;
  contributions: ContributionDTO[];
}
