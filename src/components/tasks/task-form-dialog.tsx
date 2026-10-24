"use client";
import { Plus, X } from "lucide-react";
import * as React from "react";
import { useFieldArray } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Field, FormError, describe } from "@/components/forms/field";
import { FormFooter } from "@/components/forms/form-footer";
import { OptionSelect, PRIORITY_OPTIONS, TASK_STATUS_OPTIONS } from "@/components/forms/selects";
import { useServerForm } from "@/hooks/use-server-form";
import { deleteTaskAction, saveTaskAction } from "@/modules/tasks/actions";
import { ruleToForm } from "@/modules/tasks/recurrence";
import { taskInputSchema, type TaskFormValues } from "@/modules/tasks/schema";
import type { TaskDTO } from "@/modules/tasks/types";

export interface CategoryOption {
  id: string;
  name: string;
}

function valuesFor(task: TaskDTO | null, defaultDueDate: string, defaultProjectId: string): TaskFormValues {
  if (!task) {
    return {
      title: "",
      description: "",
      status: "TODO",
      priority: "MEDIUM",
      startDate: "",
      dueDate: defaultDueDate,
      categoryId: "",
      projectId: defaultProjectId,
      tags: "",
      repeat: "NONE",
      repeatInterval: 1,
      repeatUnit: "DAYS",
      notes: "",
      subtasks: [],
    };
  }
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    priority: task.priority,
    startDate: task.startDate ?? "",
    dueDate: task.dueDate ?? "",
    categoryId: task.categoryId ?? "",
    projectId: defaultProjectId,
    tags: task.tags.join(", "),
    ...ruleToForm(task.recurrence),
    notes: task.notes ?? "",
    subtasks: task.subtasks.map((s) => ({ id: s.id, title: s.title, done: s.done })),
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskDTO | null;
  categories: CategoryOption[];
  /** Pre-filled due date for new tasks (e.g. the day clicked on the calendar). */
  defaultDueDate?: string;
  /** When set, new tasks are linked to this project (used from a project's own page). */
  defaultProjectId?: string;
}

export function TaskFormDialog({ open, onOpenChange, task, categories, defaultDueDate = "", defaultProjectId = "" }: Props) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={task ? "Edit task" : "New task"} description={task ? undefined : "Add what needs doing — only the title is required."}>
      {/* Mounted only while open, so the form always starts from the record it was opened for. */}
      {open && <TaskForm key={task?.id ?? "new"} task={task} categories={categories} defaultDueDate={defaultDueDate} defaultProjectId={defaultProjectId} onDone={() => onOpenChange(false)} />}
    </Modal>
  );
}

function TaskForm({ task, categories, defaultDueDate, defaultProjectId, onDone }: { task: TaskDTO | null; categories: CategoryOption[]; defaultDueDate: string; defaultProjectId: string; onDone: () => void }) {
  const { form, submit, pending, formError } = useServerForm({
    schema: taskInputSchema,
    defaultValues: valuesFor(task, defaultDueDate, defaultProjectId),
    action: saveTaskAction,
    successMessage: task ? "Task saved" : "Task added",
    onSuccess: onDone,
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "subtasks" });
  const [deleting, startDelete] = React.useTransition();
  const { errors } = form.formState;
  const err = (k: string) => errors[k]?.message as string | undefined;
  const repeat = form.watch("repeat");
  const [newSubtask, setNewSubtask] = React.useState("");

  const addSubtask = () => {
    const title = newSubtask.trim();
    if (!title) return;
    append({ title, done: false });
    setNewSubtask("");
  };

  const removeTask = () =>
    startDelete(async () => {
      const res = await deleteTaskAction(task!.id);
      if (res.ok) {
        toast.success("Task deleted");
        onDone();
      } else toast.error(res.error.message);
    });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={formError} />
      <Field label="Title" htmlFor="title" error={err("title")}>
        <Input {...describe("title", err("title"))} autoFocus placeholder="e.g. Finish the ABC website" {...form.register("title")} />
      </Field>
      <Field label="Description" htmlFor="description" error={err("description")}>
        <Textarea {...describe("description", err("description"))} rows={2} {...form.register("description")} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status" htmlFor="status" error={err("status")}>
          <OptionSelect {...describe("status", err("status"))} options={TASK_STATUS_OPTIONS} {...form.register("status")} />
        </Field>
        <Field label="Priority" htmlFor="priority" error={err("priority")}>
          <OptionSelect {...describe("priority", err("priority"))} options={PRIORITY_OPTIONS} {...form.register("priority")} />
        </Field>
        <Field label="Start date" htmlFor="startDate" error={err("startDate")}>
          <Input {...describe("startDate", err("startDate"))} type="date" {...form.register("startDate")} />
        </Field>
        <Field label="Due date" htmlFor="dueDate" error={err("dueDate")}>
          <Input {...describe("dueDate", err("dueDate"))} type="date" {...form.register("dueDate")} />
        </Field>
        <Field label="Category" htmlFor="categoryId" error={err("categoryId")}>
          <OptionSelect {...describe("categoryId", err("categoryId"))} emptyLabel="No category" options={categories.map((c) => ({ value: c.id, label: c.name }))} {...form.register("categoryId")} />
        </Field>
        <Field label="Tags" htmlFor="tags" error={err("tags")} hint="Separate with commas.">
          <Input {...describe("tags", err("tags"), "hint")} placeholder="design, client" {...form.register("tags")} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Repeat" htmlFor="repeat" error={err("repeat")}>
          <OptionSelect
            {...describe("repeat", err("repeat"))}
            options={[
              { value: "NONE", label: "Doesn't repeat" },
              { value: "DAILY", label: "Every day" },
              { value: "WEEKLY", label: "Every week" },
              { value: "MONTHLY", label: "Every month" },
              { value: "CUSTOM", label: "Custom…" },
            ]}
            {...form.register("repeat")}
          />
        </Field>
        {repeat === "CUSTOM" && (
          <div className="grid grid-cols-[6rem_1fr] gap-3">
            <Field label="Every" htmlFor="repeatInterval" error={err("repeatInterval")}>
              <Input {...describe("repeatInterval", err("repeatInterval"))} type="number" min={1} max={365} inputMode="numeric" {...form.register("repeatInterval")} />
            </Field>
            <Field label="Unit" htmlFor="repeatUnit" error={err("repeatUnit")}>
              <OptionSelect
                {...describe("repeatUnit", err("repeatUnit"))}
                options={[
                  { value: "DAYS", label: "days" },
                  { value: "WEEKS", label: "weeks" },
                  { value: "MONTHS", label: "months" },
                ]}
                {...form.register("repeatUnit")}
              />
            </Field>
          </div>
        )}
      </div>
      {repeat !== "NONE" && <p className="-mt-2 text-xs text-muted">When you complete it, the next one is created automatically, counted from this due date.</p>}

      <div className="space-y-2">
        <p className="text-sm font-medium">Subtasks</p>
        {fields.length > 0 && (
          <ul className="space-y-2">
            {fields.map((f, i) => (
              <li key={f.id} className="flex items-center gap-2">
                <input type="checkbox" className="size-5 shrink-0 accent-[var(--primary)]" aria-label={`Subtask ${i + 1} done`} {...form.register(`subtasks.${i}.done`)} />
                <Input aria-label={`Subtask ${i + 1}`} {...form.register(`subtasks.${i}.title`)} />
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove subtask ${i + 1}`} onClick={() => remove(i)}>
                  <X className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Input
            value={newSubtask}
            onChange={(e) => setNewSubtask(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSubtask();
              }
            }}
            placeholder="Add a subtask and press Enter"
            aria-label="New subtask"
          />
          <Button type="button" variant="secondary" onClick={addSubtask} disabled={!newSubtask.trim()}>
            <Plus className="size-4" aria-hidden /> Add
          </Button>
        </div>
        {err("subtasks") && (
          <p role="alert" className="text-xs font-medium text-danger">
            {err("subtasks")}
          </p>
        )}
      </div>

      <Field label="Notes" htmlFor="notes" error={err("notes")}>
        <Textarea {...describe("notes", err("notes"))} rows={2} {...form.register("notes")} />
      </Field>
      <p className="text-xs text-muted">Linking a task to a client or project becomes available in Phase 4, when those exist.</p>

      <FormFooter
        pending={pending}
        onCancel={onDone}
        submitLabel={task ? "Save changes" : "Add task"}
        left={
          task && (
            <ConfirmButton onConfirm={removeTask} loading={deleting} confirmLabel="Confirm delete">
              Delete
            </ConfirmButton>
          )
        }
      />
    </form>
  );
}
