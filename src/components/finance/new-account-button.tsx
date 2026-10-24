"use client";
import { Plus } from "lucide-react";
import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { AccountFormDialog } from "./account-form-dialog";

export function NewAccountButton({ children, ...props }: Omit<ButtonProps, "onClick">) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} {...props}>
        {children ?? (
          <>
            <Plus className="size-4" aria-hidden /> New account
          </>
        )}
      </Button>
      <AccountFormDialog open={open} onOpenChange={setOpen} account={null} />
    </>
  );
}
