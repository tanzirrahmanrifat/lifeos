import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { relativeDayLabel } from "@/lib/dates";
import { formatMoney, Money } from "@/lib/money";
import type { InvoiceListItem } from "@/modules/invoices/types";
import { STATUS_LABEL, STATUS_TONE } from "./invoice-meta";

export function InvoicesList({ invoices, today, dateFormat }: { invoices: InvoiceListItem[]; today: string; dateFormat: string }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
      {invoices.map((inv) => (
        <li key={inv.id}>
          <Link href={`/invoices/${inv.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{inv.number}</p>
              <p className="truncate text-xs text-muted">
                {inv.clientName} · Due {relativeDayLabel(inv.dueDate, today, dateFormat)}
              </p>
            </div>
            <Badge tone={STATUS_TONE[inv.displayStatus]}>{STATUS_LABEL[inv.displayStatus]}</Badge>
            <span className="tabular w-24 shrink-0 text-right text-sm font-semibold">{formatMoney(Money.fromDTO(inv.total))}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
