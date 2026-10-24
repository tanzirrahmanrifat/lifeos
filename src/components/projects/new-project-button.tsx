"use client";
import { Plus } from "lucide-react";
import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { ProjectFormDialog } from "./project-form-dialog";

export function NewProjectButton({ clients, defaultClientId, currency = "USD", children, ...props }: { clients: { id: string; name: string }[]; defaultClientId?: string; currency?: string } & Omit<ButtonProps, "onClick">) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} {...props}>
        {children ?? (
          <>
            <Plus className="size-4" aria-hidden /> New project
          </>
        )}
      </Button>
      <ProjectFormDialog open={open} onOpenChange={setOpen} project={null} clients={clients} defaultClientId={defaultClientId} currency={currency} />
    </>
  );
}
