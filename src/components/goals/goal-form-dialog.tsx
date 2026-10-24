"use client";
import * as React from "react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Field, FormError, describe } from "@/components/forms/field";
import { FormFooter } from "@/components/forms/form-footer";
import { GOAL_STATUS_OPTIONS, OptionSelect } from "@/components/forms/selects";
import { useServerForm } from "@/hooks/use-server-form";
import { deleteGoalAction, saveGoalAction } from "@/modules/goals/actions";
import { goalInputSchema, type GoalFormValues } from "@/modules/goals/schema";
import type { GoalDTO } from "@/modules/goals/types";
import { MilestoneFieldList } from "./milestone-list";

interface Category {
  id: string;
  name: string;
}

function valuesFor(g: GoalDTO | null): GoalFormValues {
  if (!g) return { name: "", description: "", categoryId: "", startDate: "", targetDate: "", status: "NOT_STARTED", progressMode: "FROM_MILESTONES", progress: 0, notes: "", milestones: [] };
  return {
    id: g.id,
    name: g.name,
    description: g.description ?? "",
    categoryId: g.categoryId ?? "",
    startDate: g.startDate ?? "",
    targetDate: g.targetDate ?? "",
    status: g.status,
    progressMode: g.progressMode,
    progress: g.progress,
    notes: g.notes ?? "",
    milestones: g.milestones.map((m) => ({ id: m.id, title: m.title, dueDate: m.dueDate ?? "", done: m.done })),
  };
}

export function GoalFormDialog({ open, onOpenChange, goal, categories, onDeleted }: { open: boolean; onOpenChange: (o: boolean) => void; goal: GoalDTO | null; categories: Category[]; onDeleted?: () => void }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={goal ? "Edit goal" : "New goal"} description={goal ? undefined : "A bigger outcome you're working towards."}>
      {open && <GoalForm key={goal?.id ?? "new"} goal={goal} categories={categories} onDone={() => onOpenChange(false)} onDeleted={onDeleted} />}
    </Modal>
  );
}

function GoalForm({ goal, categories, onDone, onDeleted }: { goal: GoalDTO | null; categories: Category[]; onDone: () => void; onDeleted?: () => void }) {
  const { form, submit, pending, formError } = useServerForm({
    schema: goalInputSchema,
    defaultValues: valuesFor(goal),
    action: saveGoalAction,
    successMessage: goal ? "Goal saved" : "Goal created",
    onSuccess: onDone,
  });
  const [deleting, startDelete] = React.useTransition();
  const { errors } = form.formState;
  const err = (k: string) => errors[k]?.message as string | undefined;
  const mode = form.watch("progressMode");
  const milestoneCount = form.watch("milestones")?.length ?? 0;

  const remove = () =>
    startDelete(async () => {
      const res = await deleteGoalAction(goal!.id);
      if (res.ok) {
        toast.success("Goal deleted");
        onDone();
        onDeleted?.();
      } else toast.error(res.error.message);
    });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={formError} />
      <Field label="Name" htmlFor="name" error={err("name")}>
        <Input {...describe("name", err("name"))} autoFocus placeholder="e.g. Grow my freelance business" {...form.register("name")} />
      </Field>
      <Field label="Description" htmlFor="description" error={err("description")}>
        <Textarea {...describe("description", err("description"))} rows={2} {...form.register("description")} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" htmlFor="categoryId" error={err("categoryId")}>
          <OptionSelect {...describe("categoryId", err("categoryId"))} emptyLabel="No category" options={categories.map((c) => ({ value: c.id, label: c.name }))} {...form.register("categoryId")} />
        </Field>
        <Field label="Status" htmlFor="status" error={err("status")}>
          <OptionSelect {...describe("status", err("status"))} options={GOAL_STATUS_OPTIONS} {...form.register("status")} />
        </Field>
        <Field label="Start date" htmlFor="startDate" error={err("startDate")} hint="Optional.">
          <Input {...describe("startDate", err("startDate"), "hint")} type="date" {...form.register("startDate")} />
        </Field>
        <Field label="Target date" htmlFor="targetDate" error={err("targetDate")} hint="Optional.">
          <Input {...describe("targetDate", err("targetDate"), "hint")} type="date" {...form.register("targetDate")} />
        </Field>
      </div>

      <Field label="Track progress by" htmlFor="progressMode" error={err("progressMode")}>
        <OptionSelect
          {...describe("progressMode", err("progressMode"))}
          options={[
            { value: "FROM_MILESTONES", label: milestoneCount > 0 ? "Milestones completed" : "Milestones (add some below)" },
            { value: "MANUAL", label: "A percentage I set myself" },
          ]}
          {...form.register("progressMode")}
        />
      </Field>
      {mode === "MANUAL" && (
        <Field label="Progress" htmlFor="progress" error={err("progress")}>
          <div className="flex items-center gap-3">
            <input type="range" min={0} max={100} className="flex-1 accent-[var(--primary)]" {...form.register("progress")} />
            <span className="tabular w-12 text-right text-sm font-medium">{form.watch("progress")}%</span>
          </div>
        </Field>
      )}

      <MilestoneFieldList control={form.control} error={err("milestones")} />

      <Field label="Notes" htmlFor="notes" error={err("notes")}>
        <Textarea {...describe("notes", err("notes"))} rows={2} {...form.register("notes")} />
      </Field>

      <FormFooter
        pending={pending}
        onCancel={onDone}
        submitLabel={goal ? "Save changes" : "Create goal"}
        left={goal && <ConfirmButton onConfirm={remove} loading={deleting} confirmLabel="Confirm delete">Delete</ConfirmButton>}
      />
    </form>
  );
}
