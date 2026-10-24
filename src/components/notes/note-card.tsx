"use client";
import { Pin } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { setNotePinnedAction } from "@/modules/notes/actions";
import type { NoteDTO } from "@/modules/notes/types";
import { NoteFormDialog } from "./note-form-dialog";

export function NoteCard({ note, categories, goals }: { note: NoteDTO; categories: { id: string; name: string }[]; goals: { id: string; name: string }[] }) {
  const [editing, setEditing] = React.useState(false);
  const [pinned, setPinned] = React.useState(note.pinned);
  const [, startTransition] = React.useTransition();

  const togglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !pinned;
    setPinned(next);
    startTransition(async () => {
      const res = await setNotePinnedAction({ id: note.id, pinned: next });
      if (!res.ok) {
        setPinned(!next);
        toast.error(res.error.message);
      }
    });
  };

  return (
    <>
      <Card className="flex cursor-pointer flex-col p-4 transition-shadow hover:shadow-sm" onClick={() => setEditing(true)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setEditing(true)}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 truncate font-medium">{note.title}</h3>
          <button type="button" onClick={togglePin} aria-label={pinned ? "Unpin note" : "Pin note"} className="-m-2 shrink-0 rounded-control p-2 text-muted hover:text-foreground">
            <Pin className={cn("size-4", pinned && "fill-current text-primary")} />
          </button>
        </div>
        <p className="mt-1.5 line-clamp-3 flex-1 text-sm text-muted">{note.excerpt || "No content yet."}</p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {note.categoryName && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <span aria-hidden className="size-2 rounded-full" style={{ background: note.categoryColor ?? "var(--muted)" }} />
              {note.categoryName}
            </span>
          )}
          {note.goalName && <Badge tone="info">{note.goalName}</Badge>}
          {note.tags.map((t) => (
            <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">
              #{t}
            </span>
          ))}
        </div>
      </Card>
      <NoteFormDialog open={editing} onOpenChange={setEditing} note={note} categories={categories} goals={goals} />
    </>
  );
}
