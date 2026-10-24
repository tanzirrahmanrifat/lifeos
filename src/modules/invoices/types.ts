import type { InvoiceStatus } from "@/generated/prisma/enums";
import type { MoneyDTO } from "@/lib/money";

export interface InvoiceItemDTO {
  id: string;
  description: string;
  quantity: string;
  rate: MoneyDTO;
  discountPercent: string;
  taxPercent: string;
  lineTotal: MoneyDTO;
}

export interface InvoiceDTO {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  projectId: string | null;
  projectName: string | null;
  issueDate: string;
  dueDate: string;
  currency: string;
  status: InvoiceStatus;
  /** Stored status with OVERDUE applied for display when it's actually overdue and unpaid — never written back. */
  displayStatus: InvoiceStatus;
  subtotal: MoneyDTO;
  discount: MoneyDTO;
  tax: MoneyDTO;
  total: MoneyDTO;
  amountPaid: MoneyDTO;
  balanceDue: MoneyDTO;
  notes: string | null;
  paymentTerms: string | null;
  items: InvoiceItemDTO[];
  locked: boolean;
  createdAt: string;
}

export interface InvoiceListItem {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  issueDate: string;
  dueDate: string;
  total: MoneyDTO;
  amountPaid: MoneyDTO;
  status: InvoiceStatus;
  displayStatus: InvoiceStatus;
}

export interface InvoiceListResult {
  items: InvoiceListItem[];
  total: number;
  page: number;
  pageSize: number;
  statusCounts: Record<string, number>;
}
