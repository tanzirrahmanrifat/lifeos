import type { MoneyDTO } from "@/lib/money";

export interface FinancialReport {
  range: { from: string; to: string; label: string };
  currency: string;
  income: MoneyDTO;
  expenses: MoneyDTO;
  net: MoneyDTO;
  savingsContributed: MoneyDTO;
  expenseByCategory: { categoryId: string | null; name: string; amount: MoneyDTO }[];
  incomeByClient: { clientId: string; name: string; amount: MoneyDTO }[];
  monthly: { month: string; label: string; income: MoneyDTO; expenses: MoneyDTO; net: MoneyDTO }[];
}

export interface ClientRevenueRow {
  clientId: string;
  name: string;
  revenue: MoneyDTO;
}

export interface InvoiceRow {
  id: string;
  number: string;
  clientName: string;
  dueDate: string;
  total: MoneyDTO;
  balanceDue: MoneyDTO;
}

export interface ProjectRevenueRow {
  projectId: string;
  name: string;
  clientName: string;
  revenue: MoneyDTO;
}

export interface BusinessReport {
  range: { from: string; to: string; label: string };
  currency: string;
  clientRevenue: ClientRevenueRow[];
  outstandingInvoices: InvoiceRow[];
  paidInvoices: InvoiceRow[];
  overdueInvoices: InvoiceRow[];
  projectRevenue: ProjectRevenueRow[];
}

export interface ProductivityReport {
  range: { from: string; to: string; label: string };
  tasksCompleted: number;
  tasksCreated: number;
  habitCompletionRate: number | null;
  goalProgress: { id: string; name: string; progress: number; status: string }[];
  dailyCompletions: { date: string; count: number }[];
}
