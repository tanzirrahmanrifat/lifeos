"use client";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { relativeDayLabel } from "@/lib/dates";
import { formatMoney, Money } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { TransactionDTO } from "@/modules/finance/types";
import { TransactionFormDialog } from "./transaction-form-dialog";

interface Option {
  id: string;
  name: string;
}

export function TransactionsList({ transactions, accounts, incomeCategories, expenseCategories, today, dateFormat }: { transactions: TransactionDTO[]; accounts: Option[]; incomeCategories: Option[]; expenseCategories: Option[]; today: string; dateFormat: string }) {
  const [editing, setEditing] = React.useState<TransactionDTO | null>(null);

  return (
    <>
      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
        {transactions.map((t) => {
          const income = t.type === "INCOME";
          const money = Money.fromDTO(t.amount);
          return (
            <li key={t.id}>
              <RowAction transaction={t} onEdit={() => setEditing(t)}>
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", income ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
                  {income ? <ArrowDownLeft className="size-4" aria-hidden /> : <ArrowUpRight className="size-4" aria-hidden />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.vendor || t.source || t.categoryName || (income ? "Income" : "Expense")}</p>
                  <p className="flex flex-wrap gap-x-2 text-xs text-muted">
                    <span>{relativeDayLabel(t.date, today, dateFormat)}</span>
                    <span>{t.accountName}</span>
                    {t.categoryName && <span>{t.categoryName}</span>}
                  </p>
                </div>
                <span className={cn("tabular shrink-0 text-sm font-semibold", income ? "text-success" : "text-danger")}>
                  {income ? "+" : "−"}
                  {formatMoney(money.abs())}
                </span>
              </RowAction>
            </li>
          );
        })}
      </ul>
      <TransactionFormDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} transaction={editing} accounts={accounts} incomeCategories={incomeCategories} expenseCategories={expenseCategories} defaultDate={today} />
    </>
  );
}

const ROW_CLASS = "flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2/60";

/** Most rows open the edit dialog; a donation's expense is managed on the Donations page instead. */
function RowAction({ transaction, onEdit, children }: { transaction: TransactionDTO; onEdit: () => void; children: React.ReactNode }) {
  if (transaction.donationId) {
    return (
      <Link href="/donations" className={ROW_CLASS} title="Recorded from Donations — edit it there">
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onEdit} className={ROW_CLASS}>
      {children}
    </button>
  );
}
