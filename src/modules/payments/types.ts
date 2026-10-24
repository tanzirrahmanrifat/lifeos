import type { PaymentMethod } from "@/generated/prisma/enums";
import type { MoneyDTO } from "@/lib/money";

export interface PaymentDTO {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  accountId: string;
  accountName: string;
  amount: MoneyDTO;
  date: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  voided: boolean;
}

export interface PaymentListResult {
  items: PaymentDTO[];
  total: number;
  page: number;
  pageSize: number;
}
