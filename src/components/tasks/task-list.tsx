"use client";
import { CalendarDays, Repeat, ListChecks } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { CheckButton } from "@/components/ui/check-button";
import { formatIsoDate, relativeDayLabel } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { setTaskStatusAction } from "@/modules/tasks/actions";
import { describeRecurrence } from "@/modules/tasks/recurrence";
import type { TaskDTO } from "@/modules/tasks/types";
import { PRIORITY_LABEL, PRIORITY_TONE } from "./task-meta";
import { TaskFormDialog, type CategoryOption } from "./task-form-dialog";

interface Props {
  tasks: TaskDTO[];
  categories: CategoryOption[];
  today: string;
  dateFormat: string;
  /** Task to open immediately (from ?edit=…) and where to go when it closes. */
  initialEdit?: TaskDTO | null;
  closeHref?: string;
}

export function TaskList({ tasks, categories, today, dateFormat, initialEdit = null, closeHref }: Props) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<TaskDTO | null>(initialEdit);
  const [optimistic, setOptimistic] = React.useState<Record<string, TaskDTO["status"]>>({});
  const [, startTransition] = React.useTransition();

  // Follow client-side navigation to /tasks?edit=… (e.g. from a calendar item), without a
  // setState-in-effect: react to the prop changing during render instead.
  const lastInitialEdit = React.useRef(initialEdit);
  if (lastInitialEdit.current !== initialEdit) {
    lastInitialEdit.current = initialEdit;
    if (initialEdit) setEditing(initialEdit);
  }

  const toggle = (task: TaskDTO) => {
    const next = task.status === "COMPLETED" ? "TODO" : "COMPLETED";
    setOptimistic((o) => ({ ...o, [task.id]: next }));
    startTransition(async () => {
      const res = await setTaskStatusAction({ id: task.id, status: next });
      if (!res.ok) toast.error(res.error.message);
      setOptimistic((o) => {
        const rest = { ...o };
        delete rest[task.id];
        return rest;
      });
    });
  };

  const close = (open: boolean) => {
    if (open) return;
    setEditing(null);
    if (initialEdit && closeHref) router.replace(closeHref, { scroll: false });
  };

  return (
    <>
      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
        {tasks.map((task) => {
          const status = optimistic[task.id] ?? task.status;
          const done = status === "COMPLETED";
          const cancelled = status === "CANCELLED";
          const subDone = task.subtasks.filter((s) => s.done).length;
          return (
            <li key={task.id} className="group relative flex items-start gap-1 pr-3 hover:bg-surface-2/60">
              <CheckButton checked={done} onToggle={() => toggle(task)} label={done ? `Reopen “${task.title}”` : `Complete “${task.title}”`} className="mt-1 ml-1 md:mt-1.5" />
              <button type="button" onClick={() => setEditing(task)} className="min-w-0 flex-1 py-3 text-left" aria-label={`Edit “${task.title}”`}>
                <span className={cn("block truncate text-[0.95rem] font-medium", (done || cancelled) && "text-muted line-through")}>{task.title}</span>
                <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
                  {task.dueDate && (
                    <span className={cn("inline-flex items-center gap-1", task.overdue && "font-medium text-danger", !task.overdue && task.dueDate === today && !done && "font-medium text-warning")}>
                      <CalendarDays className="size-3.5" aria-hidden />
                      {task.overdue && <span className="sr-only">Overdue: </span>}
                      {relativeDayLabel(task.dueDate, today, dateFormat)}
                    </span>
                  )}
                  {task.priority !== "MEDIUM" && task.priority !== "LOW" && <Badge tone={PRIORITY_TONE[task.priority]}>{PRIORITY_LABEL[task.priority]}</Badge>}
                  {task.status === "IN_PROGRESS" && <Badge tone="info">In progress</Badge>}
                  {cancelled && <Badge>Cancelled</Badge>}
                  {task.categoryName && (
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden className="size-2 rounded-full" style={{ background: task.categoryColor ?? "var(--muted)" }} />
                      {task.categoryName}
                    </span>
                  )}
                  {task.subtasks.length > 0 && (
                    <span className="tabular inline-flex items-center gap-1">
                      <ListChecks className="size-3.5" aria-hidden />
                      {subDone}/{task.subtasks.length}
                    </span>
                  )}
                  {task.recurrence && (
                    <span className="inline-flex items-center gap-1" title={describeRecurrence(task.recurrence)}>
                      <Repeat className="size-3.5" aria-hidden />
                      <span className="sr-only">{describeRecurrence(task.recurrence)}</span>
                    </span>
                  )}
                  {task.tags.map((t) => (
                    <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5">
                      #{t}
                    </span>
                  ))}
                  {done && task.completedAt && <span>Completed {formatIsoDate(task.completedAt.slice(0, 10), dateFormat)}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <TaskFormDialog open={editing !== null} onOpenChange={close} task={editing} categories={categories} />
    </>
  );
}
