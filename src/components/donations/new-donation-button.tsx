"use client";
import { Plus } from "lucide-react";
import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { DonationFormDialog, type DonationAccountOption } from "./donation-form-dialog";

export function NewDonationButton({ categories, accounts, defaultCurrency, today, children, ...props }: { categories: { id: string; name: string }[]; accounts: DonationAccountOption[]; defaultCurrency: string; today: string } & Omit<ButtonProps, "onClick">) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} {...props}>
        {children ?? (
          <>
            <Plus className="size-4" aria-hidden /> New donation
          </>
        )}
      </Button>
      <DonationFormDialog open={open} onOpenChange={setOpen} donation={null} categories={categories} accounts={accounts} defaultCurrency={defaultCurrency} today={today} />
    </>
  );
}
