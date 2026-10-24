import { ArrowRight } from "lucide-react";
import { formatIsoDate } from "@/lib/dates";
import { formatMoney, Money } from "@/lib/money";
import type { TransferDTO } from "@/modules/finance/types";

export function TransfersList({ transfers, dateFormat }: { transfers: TransferDTO[]; dateFormat: string }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
      {transfers.map((t) => (
        <li key={t.id} className="flex items-center gap-3 px-4 py-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-info-soft text-info">
            <ArrowRight className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {t.fromAccountName} → {t.toAccountName}
            </p>
            <p className="text-xs text-muted">{formatIsoDate(t.date, dateFormat)}</p>
          </div>
          <span className="tabular shrink-0 text-sm font-semibold">{formatMoney(Money.fromDTO(t.amountFrom))}</span>
        </li>
      ))}
    </ul>
  );
}
