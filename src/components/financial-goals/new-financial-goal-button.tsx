"use client";
import { Plus } from "lucide-react";
import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { FinancialGoalFormDialog } from "./goal-form-dialog";

export function NewFinancialGoalButton({ categories, currency, children, ...props }: { categories: { id: string; name: string }[]; currency: string } & Omit<ButtonProps, "onClick">) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} {...props}>
        {children ?? (
          <>
            <Plus className="size-4" aria-hidden /> New financial goal
          </>
        )}
      </Button>
      <FinancialGoalFormDialog open={open} onOpenChange={setOpen} goal={null} categories={categories} currency={currency} />
    </>
  );
}
