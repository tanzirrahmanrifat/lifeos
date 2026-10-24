"use client";
import * as React from "react";
import { toast } from "sonner";
import { CheckButton } from "@/components/ui/check-button";
import { cn } from "@/lib/utils";
import { setTaskStatusAction } from "@/modules/tasks/actions";
import { setMilestoneDoneAction } from "@/modules/goals/actions";
import Link from "next/link";
import type { CalendarItem } from "@/modules/calendar/types";
import { ItemIcon } from "./item-icon";

function ItemBody({ item, done }: { item: CalendarItem; done: boolean }) {
  return (
    <>
      <span className={cn("block truncate text-sm", done && "text-muted line-through")}>{item.title}</span>
      <span className="flex flex-wrap gap-x-2 text-xs text-muted">
        {item.time && <span className="tabular">{item.time}</span>}
        {item.subtitle && <span className="truncate">{item.subtitle}</span>}
      </span>
    </>
  );
}

const TONE_TEXT = { primary: "text-primary", info: "text-info", warning: "text-warning", danger: "text-danger", success: "text-success", neutral: "text-muted" } as const;

/** One agenda row. Tasks and milestones can be checked off right here; everything opens its editor. */
export function CalendarItemRow({ item, onOpenEvent }: { item: CalendarItem; onOpenEvent: (id: string) => void }) {
  const [done, setDone] = React.useState(item.done);
  const [, startTransition] = React.useTransition();
  const checkable = item.kind === "task" || item.kind === "milestone";

  const toggle = () => {
    const next = !done;
    setDone(next);
    startTransition(async () => {
      const res =
        item.kind === "task" ? await setTaskStatusAction({ id: item.ref.id, status: next ? "COMPLETED" : "TODO" }) : await setMilestoneDoneAction({ goalId: item.ref.parentId!, milestoneId: item.ref.id, done: next });
      if (!res.ok) {
        setDone(!next);
        toast.error(res.error.message);
      }
    });
  };

  return (
    <li className="flex items-center gap-1 rounded-control hover:bg-surface-2/60">
      {checkable ? (
        <CheckButton checked={done} onToggle={toggle} label={done ? `Undo “${item.title}”` : `Complete “${item.title}”`} className="size-9" />
      ) : (
        <span className={cn("grid size-9 shrink-0 place-items-center", TONE_TEXT[item.tone])}>
          <ItemIcon kind={item.kind} className="size-4" />
        </span>
      )}
      {item.kind === "event" ? (
        <button type="button" onClick={() => onOpenEvent(item.ref.id)} className="min-w-0 flex-1 py-2 pr-2 text-left">
          <ItemBody item={item} done={done} />
        </button>
      ) : (
        <Link
          href={
            item.kind === "task"
              ? `/tasks?view=all&edit=${item.ref.id}`
              : item.kind === "invoice"
                ? `/invoices/${item.ref.id}`
                : item.kind === "project"
                  ? `/projects/${item.ref.id}`
                  : `/goals/${item.ref.parentId ?? item.ref.id}`
          }
          className="min-w-0 flex-1 py-2 pr-2 text-left"
        >
          <ItemBody item={item} done={done} />
        </Link>
      )}
    </li>
  );
}
