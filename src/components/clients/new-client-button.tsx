"use client";
import { Plus } from "lucide-react";
import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { ClientFormDialog } from "./client-form-dialog";

export function NewClientButton({ children, ...props }: Omit<ButtonProps, "onClick">) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} {...props}>
        {children ?? (
          <>
            <Plus className="size-4" aria-hidden /> New client
          </>
        )}
      </Button>
      <ClientFormDialog open={open} onOpenChange={setOpen} client={null} />
    </>
  );
}
