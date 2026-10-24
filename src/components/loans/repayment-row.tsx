"use client";
import { X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatIsoDate } from "@/lib/dates";
import { formatMoney, Money } from "@/lib/money";
import { deleteRepaymentAction } from "@/modules/loans/actions";
import type { LoanRepaymentDTO } from "@/modules/loans/types";

export function RepaymentRow({ loanId, repayment, direction, dateFormat, canRemove }: { loanId: string; repayment: LoanRepaymentDTO; direction: "LENT" | "BORROWED"; dateFormat: string; canRemove: boolean }) {
  const [pending, startTransition] = React.useTransition();
  const remove = () =>
    startTransition(async () => {
      const res = await deleteRepaymentAction({ loanId, repaymentId: repayment.id });
      if (res.ok) toast.success("Repayment removed");
      else toast.error(res.error.message);
    });
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
      <span className="tabular flex-1 text-sm font-medium">{formatMoney(Money.fromDTO(repayment.amount))}</span>
      <span className="text-xs text-muted">{formatIsoDate(repayment.date, dateFormat)}</span>
      {repayment.accountName && (
        <span className="text-xs text-muted">
          {direction === "LENT" ? "into" : "from"} {repayment.accountName}
        </span>
      )}
      {canRemove && (
        <Button variant="ghost" size="icon" aria-label="Remove repayment" onClick={remove} disabled={pending}>
          <X className="size-4" />
        </Button>
      )}
    </li>
  );
}
