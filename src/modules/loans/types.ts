import type { LoanDirection, LoanKind } from "@/generated/prisma/enums";
import type { MoneyDTO } from "@/lib/money";

/** OPEN = nothing repaid yet, PARTIAL = some repaid, SETTLED = fully repaid, FORGIVEN = rest waived. */
export type LoanStatus = "OPEN" | "PARTIAL" | "SETTLED" | "FORGIVEN";

export interface LoanRepaymentDTO {
  id: string;
  amount: MoneyDTO;
  date: string;
  accountId: string | null;
  accountName: string | null;
  notes: string | null;
}

export interface LoanDTO {
  id: string;
  direction: LoanDirection;
  kind: LoanKind;
  personName: string;
  personPhone: string | null;
  principal: MoneyDTO;
  repaid: MoneyDTO;
  forgiven: MoneyDTO;
  outstanding: MoneyDTO;
  progressPct: number;
  date: string;
  dueDate: string | null;
  overdue: boolean;
  status: LoanStatus;
  accountId: string | null;
  accountName: string | null;
  notes: string | null;
  /** True once any repayment exists or the rest was forgiven — amount, currency, account and date are then locked. */
  locked: boolean;
}

export interface LoanDetailDTO extends LoanDTO {
  repayments: LoanRepaymentDTO[];
}

/** Outstanding totals, one entry per currency (never mixed without an exchange rate). */
export interface LoanTotals {
  receivable: MoneyDTO[];
  payable: MoneyDTO[];
  qardHasanReceivable: MoneyDTO[];
  qardHasanPayable: MoneyDTO[];
  overdueCount: number;
  openCount: number;
}
