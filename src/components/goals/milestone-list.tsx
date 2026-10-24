"use client";
import { Plus, X } from "lucide-react";
import * as React from "react";
import { useFieldArray, type Control, type FieldValues } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function MilestoneFieldList({ control, error }: { control: Control<FieldValues>; error?: string }) {
  const { fields, append, remove } = useFieldArray({ control, name: "milestones" as const });
  const [draft, setDraft] = React.useState("");

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    append({ title, dueDate: "", done: false });
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Milestones</p>
      {fields.length > 0 && (
        <ul className="space-y-2">
          {fields.map((f, i) => (
            <li key={f.id} className="flex items-center gap-2">
              <input type="checkbox" className="size-5 shrink-0 accent-[var(--primary)]" aria-label={`Milestone ${i + 1} done`} {...control.register(`milestones.${i}.done` as const)} />
              <Input aria-label={`Milestone ${i + 1}`} className="flex-1" {...control.register(`milestones.${i}.title` as const)} />
              <Input aria-label={`Milestone ${i + 1} due date`} type="date" className="w-40" {...control.register(`milestones.${i}.dueDate` as const)} />
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove milestone ${i + 1}`} onClick={() => remove(i)}>
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add a milestone and press Enter"
          aria-label="New milestone"
        />
        <Button type="button" variant="secondary" onClick={add} disabled={!draft.trim()}>
          <Plus className="size-4" aria-hidden /> Add
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
