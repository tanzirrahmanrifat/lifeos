import type { MoneyDTO } from "@/lib/money";

export interface DonationDTO {
  id: string;
  recipient: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  amount: MoneyDTO;
  date: string;
  accountId: string | null;
  accountName: string | null;
  /** Set when it was logged by forgiving a loan; edit or remove it from that loan instead. */
  loanId: string | null;
  notes: string | null;
}

export interface DonationCategoryTotal {
  categoryId: string | null;
  categoryName: string;
  categoryColor: string | null;
  totals: MoneyDTO[];
}

export interface DonationSummary {
  year: number;
  /** Per currency; never converted. */
  thisMonth: MoneyDTO[];
  thisYear: MoneyDTO[];
  allTime: MoneyDTO[];
  byCategory: DonationCategoryTotal[];
  /** Years that have at least one donation, newest first (always includes the current year). */
  years: number[];
}
