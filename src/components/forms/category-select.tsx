"use client";
import { Check, Plus, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OptionSelect } from "@/components/forms/selects";
import { createCategoryAction } from "@/modules/settings/actions";

export type CategoryKind = "INCOME" | "EXPENSE" | "TASK" | "GOAL" | "NOTE" | "HABIT" | "DONATION";

interface CategoryOption {
  id: string;
  name: string;
}

const DEFAULT_COLOR = "#0e6b5c";

/**
 * A category <select> with a "+" button that creates a new category of `type` in place and selects
 * it, so nobody has to leave a half-filled form to visit Settings → Categories.
 */
export function CategorySelect({
  id,
  type,
  categories,
  value,
  onValueChange,
  emptyLabel = "No category",
  ...aria
}: {
  id: string;
  type: CategoryKind;
  categories: CategoryOption[];
  value: string;
  onValueChange: (id: string) => void;
  emptyLabel?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const [created, setCreated] = React.useState<CategoryOption[]>([]);
  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const options = [...categories, ...created.filter((c) => !categories.some((x) => x.id === c.id))].sort((a, b) => a.name.localeCompare(b.name));

  const close = () => {
    setAdding(false);
    setName("");
    setError(null);
  };

  const create = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      setError(null);
      const res = await createCategoryAction({ type, name: name.trim(), color: DEFAULT_COLOR });
      if (!res.ok) {
        setError(res.error.fieldErrors?.name?.[0] ?? res.error.message);
        return;
      }
      setCreated((prev) => [...prev, { id: res.data.id, name: res.data.name }]);
      onValueChange(res.data.id);
      toast.success(`Category “${res.data.name}” added`);
      close();
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <OptionSelect
          id={id}
          {...aria}
          className="min-w-0 flex-1"
          emptyLabel={emptyLabel}
          options={options.map((c) => ({ value: c.id, label: c.name }))}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
        />
        <Button type="button" variant="outline" size="icon" aria-label="Create a new category" aria-expanded={adding} onClick={() => (adding ? close() : setAdding(true))}>
          {adding ? <X className="size-4" /> : <Plus className="size-4" />}
        </Button>
      </div>
      {adding && (
        <div className="flex gap-2">
          <Input
            autoFocus
            value={name}
            maxLength={40}
            placeholder="New category name"
            aria-label="New category name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              // This input lives inside the parent form; Enter must create the category, not submit the form.
              if (e.key === "Enter") {
                e.preventDefault();
                create();
              }
            }}
          />
          <Button type="button" variant="secondary" onClick={create} loading={pending} disabled={!name.trim()}>
            <Check className="size-4" aria-hidden /> Add
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
