"use client";
import * as React from "react";
import { Card } from "@/components/ui/card";
import { formatMoney, Money } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { AccountDTO } from "@/modules/finance/types";
import { ACCOUNT_ICON, ACCOUNT_TYPE_LABEL } from "./account-meta";
import { AccountFormDialog } from "./account-form-dialog";

export function AccountCard({ account, hasActivity }: { account: AccountDTO; hasActivity: boolean }) {
  const [editing, setEditing] = React.useState(false);
  const Icon = ACCOUNT_ICON[account.type]!;
  const money = Money.fromDTO(account.balance);

  return (
    <>
      <button type="button" onClick={() => setEditing(true)} className="text-left">
        <Card className={cn("flex h-full flex-col p-4 transition-shadow hover:shadow-sm", account.archived && "opacity-60")}>
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-control bg-primary-soft text-primary">
              <Icon className="size-[18px]" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{account.name}</p>
              <p className="text-xs text-muted">
                {ACCOUNT_TYPE_LABEL[account.type]}
                {account.isSavings ? " · Savings" : ""}
                {account.archived ? " · Archived" : ""}
              </p>
            </div>
          </div>
          <p className={cn("tabular mt-3 text-xl font-semibold", money.isNegative() && "text-danger")}>{formatMoney(money)}</p>
        </Card>
      </button>
      <AccountFormDialog open={editing} onOpenChange={setEditing} account={account} hasActivity={hasActivity} />
    </>
  );
}
