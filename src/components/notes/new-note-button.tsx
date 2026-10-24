"use client";
import { Plus } from "lucide-react";
import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { NoteFormDialog } from "./note-form-dialog";

export function NewNoteButton({ categories, goals, children, ...props }: { categories: { id: string; name: string }[]; goals: { id: string; name: string }[] } & Omit<ButtonProps, "onClick">) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} {...props}>
        {children ?? (
          <>
            <Plus className="size-4" aria-hidden /> New note
          </>
        )}
      </Button>
      <NoteFormDialog open={open} onOpenChange={setOpen} note={null} categories={categories} goals={goals} />
    </>
  );
}
