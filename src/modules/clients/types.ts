import type { ClientStatus } from "@/generated/prisma/enums";
import type { MoneyDTO } from "@/lib/money";

export interface ClientDTO {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  country: string | null;
  status: ClientStatus;
  notes: string | null;
  createdAt: string;
}

export interface ClientListItem extends ClientDTO {
  totalRevenue: MoneyDTO;
  outstanding: MoneyDTO;
  projectCount: number;
  openInvoiceCount: number;
}

export interface ClientDetail extends ClientDTO {
  totalRevenue: MoneyDTO;
  outstanding: MoneyDTO;
}

export interface ClientListResult {
  items: ClientListItem[];
  total: number;
  page: number;
  pageSize: number;
}
