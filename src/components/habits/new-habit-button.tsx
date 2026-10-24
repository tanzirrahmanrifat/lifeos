"use client";
import { Plus } from "lucide-react";
import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { HabitFormDialog } from "./habit-form-dialog";

export function NewHabitButton({ categories, today, children, ...props }: { categories: { id: string; name: string }[]; today: string } & Omit<ButtonProps, "onClick">) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} {...props}>
        {children ?? (
          <>
            <Plus className="size-4" aria-hidden /> New habit
          </>
        )}
      </Button>
      <HabitFormDialog open={open} onOpenChange={setOpen} habit={null} categories={categories} today={today} />
    </>
  );
}
