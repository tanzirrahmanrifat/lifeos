"use client";
import { Plus } from "lucide-react";
import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { TaskFormDialog, type CategoryOption } from "./task-form-dialog";

export function NewTaskButton({
  categories,
  defaultDueDate,
  defaultProjectId,
  children,
  ...props
}: { categories: CategoryOption[]; defaultDueDate?: string; defaultProjectId?: string } & Omit<ButtonProps, "onClick">) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} {...props}>
        {children ?? (
          <>
            <Plus className="size-4" aria-hidden /> New task
          </>
        )}
      </Button>
      <TaskFormDialog open={open} onOpenChange={setOpen} task={null} categories={categories} defaultDueDate={defaultDueDate} defaultProjectId={defaultProjectId} />
    </>
  );
}
