"use client";
import { Check, Lock, Pencil, Plus, Trash2, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { archiveCategoryAction, createCategoryAction, updateCategoryAction } from "@/modules/settings/actions";

type CategoryType = "INCOME" | "EXPENSE" | "TASK" | "GOAL" | "NOTE" | "HABIT" | "DONATION";
interface Category {
  id: string;
  type: CategoryType;
  name: string;
  color: string | null;
  isSystem: boolean;
}

const TYPES: { value: CategoryType; label: string; hint: string }[] = [
  { value: "INCOME", label: "Income", hint: "Used when you record money coming in." },
  { value: "EXPENSE", label: "Expense", hint: "Used for spending, budgets and the expense breakdown." },
  { value: "DONATION", label: "Donation (দান)", hint: "Sadaqah, Zakat, Fitra… used on the Donations page." },
  { value: "TASK", label: "Task", hint: "Group your to-dos." },
  { value: "GOAL", label: "Goal", hint: "Group your goals." },
  { value: "HABIT", label: "Habit", hint: "Group your habits." },
  { value: "NOTE", label: "Note", hint: "Group your notes." },
];

export function CategoriesManager({ categories }: { categories: Category[] }) {
  const [type, setType] = React.useState<CategoryType>("EXPENSE");
  const [pending, startTransition] = React.useTransition();
  const [newName, setNewName] = React.useState("");
  const [newColor, setNewColor] = React.useState("#0e6b5c");
  const [editing, setEditing] = React.useState<{ id: string; name: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const list = categories.filter((c) => c.type === type);
  const active = TYPES.find((t) => t.value === type)!;

  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string; fieldErrors?: Record<string, string[]> } }>, done?: () => void) =>
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (res.ok) done?.();
      else setError(res.error?.fieldErrors?.name?.[0] ?? res.error?.message ?? "Something went wrong.");
    });

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    run(
      () => createCategoryAction({ type, name: newName, color: newColor }),
      () => {
        setNewName("");
        toast.success("Category added");
      },
    );
  };

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Category type" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0">
        {TYPES.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={type === t.value}
            onClick={() => {
              setType(t.value);
              setError(null);
              setEditing(null);
            }}
            className={cn(
              "min-h-10 shrink-0 rounded-full px-4 text-sm transition-colors",
              type === t.value ? "bg-primary text-primary-foreground" : "bg-surface-2 text-muted hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted">{active.hint}</p>

      <form onSubmit={add} className="flex flex-wrap items-center gap-2" noValidate>
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={`New ${active.label.toLowerCase()} category`} maxLength={40} aria-label="Category name" className="min-w-0 flex-1 basis-48" />
        <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} aria-label="Category colour" className="size-11 cursor-pointer rounded-control border border-line bg-surface p-1 md:size-10" />
        <Button type="submit" loading={pending} disabled={!newName.trim()}>
          <Plus className="size-4" aria-hidden /> Add
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}

      {list.length === 0 ? (
        <EmptyState title={`No ${active.label.toLowerCase()} categories`} description="Add your first one above." />
      ) : (
        <ul className="divide-y divide-line rounded-card border border-line">
          {list.map((c) => {
            const isEditing = editing?.id === c.id;
            return (
              <li key={c.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
                <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: c.color ?? "var(--muted)" }} />
                {isEditing ? (
                  <form
                    className="flex flex-1 items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(
                        () => updateCategoryAction({ id: c.id, name: editing.name, color: c.color ?? undefined }),
                        () => setEditing(null),
                      );
                    }}
                  >
                    <Input autoFocus value={editing.name} onChange={(e) => setEditing({ id: c.id, name: e.target.value })} maxLength={40} aria-label="Category name" />
                    <Button type="submit" size="icon" variant="secondary" aria-label="Save name" loading={pending}>
                      <Check className="size-4" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" aria-label="Cancel" onClick={() => setEditing(null)}>
                      <X className="size-4" />
                    </Button>
                  </form>
                ) : (
                  <>
                    <span className="flex-1 truncate text-sm">{c.name}</span>
                    {c.isSystem ? (
                      <span className="flex items-center gap-1 text-xs text-muted" title="Used by the system, can't be renamed or removed">
                        <Lock className="size-3.5" aria-hidden /> System
                      </span>
                    ) : (
                      <>
                        <Button size="icon" variant="ghost" aria-label={`Rename ${c.name}`} onClick={() => setEditing({ id: c.id, name: c.name })}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Remove ${c.name}`}
                          disabled={pending}
                          onClick={() => run(() => archiveCategoryAction(c.id), () => toast.success(`“${c.name}” removed`))}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted">Removing a category hides it from new records. Past transactions keep their category, so your history stays accurate.</p>
    </div>
  );
}
