"use client";
import { Plus } from "lucide-react";
import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { GoalFormDialog } from "./goal-form-dialog";

export function NewGoalButton({ categories, children, ...props }: { categories: { id: string; name: string }[] } & Omit<ButtonProps, "onClick">) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} {...props}>
        {children ?? (
          <>
            <Plus className="size-4" aria-hidden /> New goal
          </>
        )}
      </Button>
      <GoalFormDialog open={open} onOpenChange={setOpen} goal={null} categories={categories} />
    </>
  );
}
