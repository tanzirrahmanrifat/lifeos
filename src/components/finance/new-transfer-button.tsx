"use client";
import { ArrowLeftRight } from "lucide-react";
import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import type { AccountDTO } from "@/modules/finance/types";
import { TransferFormDialog } from "./transfer-form-dialog";

export function NewTransferButton({ accounts, today, children, ...props }: { accounts: AccountDTO[]; today: string } & Omit<ButtonProps, "onClick">) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} {...props}>
        {children ?? (
          <>
            <ArrowLeftRight className="size-4" aria-hidden /> Transfer
          </>
        )}
      </Button>
      <TransferFormDialog open={open} onOpenChange={setOpen} accounts={accounts} today={today} />
    </>
  );
}
