import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatMoney, Money } from "@/lib/money";
import type { ClientListItem } from "@/modules/clients/types";

const STATUS_TONE = { LEAD: "warning", ACTIVE: "success", INACTIVE: "neutral", COMPLETED: "info" } as const;
const STATUS_LABEL = { LEAD: "Lead", ACTIVE: "Active", INACTIVE: "Inactive", COMPLETED: "Completed" } as const;

export function ClientCard({ client }: { client: ClientListItem }) {
  return (
    <Link href={`/clients/${client.id}`}>
      <Card className="flex h-full flex-col p-4 transition-shadow hover:shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{client.name}</p>
            {client.company && <p className="truncate text-xs text-muted">{client.company}</p>}
          </div>
          <Badge tone={STATUS_TONE[client.status]}>{STATUS_LABEL[client.status]}</Badge>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-muted">Revenue</p>
            <p className="tabular font-medium text-success">{formatMoney(Money.fromDTO(client.totalRevenue))}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Outstanding</p>
            <p className={`tabular font-medium ${Money.fromDTO(client.outstanding).isPositive() ? "text-warning" : ""}`}>{formatMoney(Money.fromDTO(client.outstanding))}</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">
          {client.projectCount} project{client.projectCount === 1 ? "" : "s"} · {client.openInvoiceCount} open invoice{client.openInvoiceCount === 1 ? "" : "s"}
        </p>
      </Card>
    </Link>
  );
}
