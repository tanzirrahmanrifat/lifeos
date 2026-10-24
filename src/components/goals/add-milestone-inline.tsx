"use client";
import { Plus } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addMilestoneAction } from "@/modules/goals/actions";

export function AddMilestoneInline({ goalId }: { goalId: string }) {
  const [title, setTitle] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const add = () => {
    const t = title.trim();
    if (!t) return;
    startTransition(async () => {
      const res = await addMilestoneAction({ goalId, title: t, dueDate });
      if (res.ok) {
        setTitle("");
        setDueDate("");
      } else toast.error(res.error.message);
    });
  };

  return (
    <div className="mt-3 flex gap-2">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        placeholder="Add a milestone"
        aria-label="New milestone"
        className="flex-1"
      />
      <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-label="Milestone due date" className="w-40" />
      <Button type="button" variant="secondary" onClick={add} loading={pending} disabled={!title.trim()}>
        <Plus className="size-4" aria-hidden /> Add
      </Button>
    </div>
  );
}
