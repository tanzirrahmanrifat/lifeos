"use client";
import { Plus } from "lucide-react";
import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { LoanFormDialog, type LoanAccountOption } from "./loan-form-dialog";

export function NewLoanButton({
  accounts,
  defaultDirection,
  defaultCurrency,
  today,
  children,
  ...props
}: { accounts: LoanAccountOption[]; defaultDirection?: "LENT" | "BORROWED"; defaultCurrency: string; today: string } & Omit<ButtonProps, "onClick">) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} {...props}>
        {children ?? (
          <>
            <Plus className="size-4" aria-hidden /> New loan
          </>
        )}
      </Button>
      <LoanFormDialog open={open} onOpenChange={setOpen} loan={null} accounts={accounts} defaultDirection={defaultDirection} defaultCurrency={defaultCurrency} today={today} />
    </>
  );
}
