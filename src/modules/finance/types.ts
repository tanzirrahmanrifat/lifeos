import type { AccountType, TransactionType } from "@/generated/prisma/enums";
import type { MoneyDTO } from "@/lib/money";

export interface AccountDTO {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  balance: MoneyDTO;
  isSavings: boolean;
  archived: boolean;
}

export interface TransactionDTO {
  id: string;
  type: TransactionType;
  amount: MoneyDTO;
  date: string;
  accountId: string;
  accountName: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  vendor: string | null;
  source: string | null;
  notes: string | null;
  clientId: string | null;
  projectId: string | null;
  paymentId: string | null;
  transferId: string | null;
}

export interface TransactionListResult {
  items: TransactionDTO[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TransferDTO {
  id: string;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  amountFrom: MoneyDTO;
  amountTo: MoneyDTO;
  date: string;
  notes: string | null;
}

export interface CategorySpend {
  categoryId: string | null;
  categoryName: string;
  categoryColor: string | null;
  spent: MoneyDTO;
  budget: MoneyDTO | null;
}

export interface BudgetSummary {
  month: string;
  currency: string;
  incomeTarget: MoneyDTO;
  incomeActual: MoneyDTO;
  savingsTarget: MoneyDTO;
  savingsActual: MoneyDTO;
  expenseLines: CategorySpend[];
  otherExpenses: MoneyDTO;
  totalBudgeted: MoneyDTO;
  totalSpent: MoneyDTO;
}
