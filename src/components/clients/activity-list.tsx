import { CreditCard, FilePlus2, Send, UserPlus, XCircle, type LucideIcon } from "lucide-react";
import { formatIsoDate } from "@/lib/dates";
import { Money, formatMoney } from "@/lib/money";
import type { ActivityEntry } from "@/modules/clients/service";

const ICON: Record<string, LucideIcon> = { client_created: UserPlus, project_created: FilePlus2, invoice_created: FilePlus2, invoice_sent: Send, payment_recorded: CreditCard, payment_voided: XCircle };

function describe(entry: ActivityEntry): string {
  const meta = entry.meta ?? {};
  switch (entry.action) {
    case "client_created":
      return "Client added";
    case "project_created":
      return `Project “${meta.name}” created`;
    case "invoice_created":
      return `Invoice ${meta.number} created (${formatMoney(Money.of(BigInt(meta.total as string), meta.currency as string))})`;
    case "invoice_sent":
      return `Invoice ${meta.number} sent`;
    case "payment_recorded":
      return `Payment of ${formatMoney(Money.of(BigInt(meta.amount as string), meta.currency as string))} recorded on ${meta.invoiceNumber}`;
    case "payment_voided":
      return `Payment of ${formatMoney(Money.of(BigInt(meta.amount as string), meta.currency as string))} voided on ${meta.invoiceNumber}`;
    default:
      return entry.action;
  }
}

export function ActivityList({ entries, dateFormat }: { entries: ActivityEntry[]; dateFormat: string }) {
  if (entries.length === 0) return <p className="py-4 text-sm text-muted">No activity yet.</p>;
  return (
    <ul className="space-y-3">
      {entries.map((e) => {
        const Icon = ICON[e.action] ?? UserPlus;
        return (
          <li key={e.id} className="flex items-start gap-2.5 text-sm">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-muted">
              <Icon className="size-3.5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p>{describe(e)}</p>
              <p className="text-xs text-muted">{formatIsoDate(e.at.slice(0, 10), dateFormat)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
