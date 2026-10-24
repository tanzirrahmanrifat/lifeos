"use client";
import * as React from "react";
import { formatIsoDate } from "@/lib/dates";
import { formatMoney, Money } from "@/lib/money";
import type { DonationDTO } from "@/modules/donations/types";
import { DonationFormDialog, type DonationAccountOption } from "./donation-form-dialog";

export function DonationsList({ donations, categories, accounts, defaultCurrency, today, dateFormat }: { donations: DonationDTO[]; categories: { id: string; name: string }[]; accounts: DonationAccountOption[]; defaultCurrency: string; today: string; dateFormat: string }) {
  const [editing, setEditing] = React.useState<DonationDTO | null>(null);
  return (
    <>
      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
        {donations.map((d) => (
          <li key={d.id}>
            <button type="button" onClick={() => setEditing(d)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2/60">
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: d.categoryColor ?? "var(--muted)" }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.recipient || d.categoryName || "Donation"}</p>
                <p className="flex flex-wrap gap-x-2 text-xs text-muted">
                  <span>{formatIsoDate(d.date, dateFormat)}</span>
                  {d.categoryName && d.recipient && <span>{d.categoryName}</span>}
                  {d.accountName && <span>from {d.accountName}</span>}
                  {d.loanId && <span>forgiven loan</span>}
                </p>
              </div>
              <span className="tabular shrink-0 text-sm font-semibold">{formatMoney(Money.fromDTO(d.amount))}</span>
            </button>
          </li>
        ))}
      </ul>
      <DonationFormDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} donation={editing} categories={categories} accounts={accounts} defaultCurrency={defaultCurrency} today={today} />
    </>
  );
}
