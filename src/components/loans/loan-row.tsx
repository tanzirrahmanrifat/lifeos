import { CalendarClock, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { formatIsoDate } from "@/lib/dates";
import { formatMoney, Money } from "@/lib/money";
import type { LoanDTO } from "@/modules/loans/types";
import { KIND_SHORT, STATUS_LABEL, STATUS_TONE } from "./loan-meta";

export function LoanRow({ loan, dateFormat }: { loan: LoanDTO; dateFormat: string }) {
  const outstanding = Money.fromDTO(loan.outstanding);
  return (
    <li>
      <Link href={`/loans/${loan.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-medium">{loan.personName}</span>
            <Badge tone={loan.kind === "QARD_HASAN" ? "primary" : "neutral"}>{KIND_SHORT[loan.kind]}</Badge>
            <Badge tone={STATUS_TONE[loan.status]}>{STATUS_LABEL[loan.status]}</Badge>
            {loan.overdue && <Badge tone="danger">Overdue</Badge>}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <ProgressBar className="max-w-48" value={loan.progressPct} tone={loan.status === "SETTLED" ? "success" : "primary"} label={`${loan.personName} repaid`} />
            <span className="tabular text-xs text-muted">
              {formatMoney(Money.fromDTO(loan.repaid))} of {formatMoney(Money.fromDTO(loan.principal))} repaid
            </span>
          </div>
          {loan.dueDate && (
            <p className={`mt-1 flex items-center gap-1 text-xs ${loan.overdue ? "text-danger" : "text-muted"}`}>
              <CalendarClock className="size-3.5" aria-hidden /> Due {formatIsoDate(loan.dueDate, dateFormat)}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="tabular font-semibold">{formatMoney(outstanding)}</p>
          <p className="text-xs text-muted">{loan.direction === "LENT" ? "to receive" : "to pay"}</p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
      </Link>
    </li>
  );
}
