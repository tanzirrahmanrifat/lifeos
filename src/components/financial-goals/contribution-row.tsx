"use client";
import { X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatIsoDate } from "@/lib/dates";
import { formatMoney, Money } from "@/lib/money";
import { deleteContributionAction } from "@/modules/financial-goals/actions";
import type { ContributionDTO } from "@/modules/financial-goals/types";

export function ContributionRow({ goalId, contribution, dateFormat }: { goalId: string; contribution: ContributionDTO; dateFormat: string }) {
  const [pending, startTransition] = React.useTransition();
  const remove = () =>
    startTransition(async () => {
      const res = await deleteContributionAction({ goalId, contributionId: contribution.id });
      if (!res.ok) toast.error(res.error.message);
    });
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="tabular flex-1 text-sm font-medium text-success">+{formatMoney(Money.fromDTO(contribution.amount))}</span>
      <span className="text-xs text-muted">{formatIsoDate(contribution.date, dateFormat)}</span>
      {contribution.sourceAccountName && <span className="text-xs text-muted">from {contribution.sourceAccountName}</span>}
      <Button variant="ghost" size="icon" aria-label="Remove contribution" onClick={remove} disabled={pending}>
        <X className="size-4" />
      </Button>
    </li>
  );
}
