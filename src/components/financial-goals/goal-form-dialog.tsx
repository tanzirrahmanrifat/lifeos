"use client";
import * as React from "react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Field, FormError, describe } from "@/components/forms/field";
import { FormFooter } from "@/components/forms/form-footer";
import { OptionSelect } from "@/components/forms/selects";
import { useServerForm } from "@/hooks/use-server-form";
import { deleteFinancialGoalAction, saveFinancialGoalAction } from "@/modules/financial-goals/actions";
import { financialGoalInputSchema, type FinancialGoalFormValues } from "@/modules/financial-goals/schema";
import type { FinancialGoalDTO } from "@/modules/financial-goals/types";

interface Category {
  id: string;
  name: string;
}

function valuesFor(g: FinancialGoalDTO | null): FinancialGoalFormValues {
  if (!g) return { name: "", targetAmount: "", targetDate: "", categoryId: "", priority: "MEDIUM", status: "ACTIVE", notes: "" };
  return { id: g.id, name: g.name, targetAmount: (Number(g.target.minor) / 100).toFixed(2), targetDate: g.targetDate ?? "", categoryId: g.categoryId ?? "", priority: g.priority, status: g.status, notes: g.notes ?? "" };
}

export function FinancialGoalFormDialog({ open, onOpenChange, goal, categories, currency, onDeleted }: { open: boolean; onOpenChange: (o: boolean) => void; goal: FinancialGoalDTO | null; categories: Category[]; currency: string; onDeleted?: () => void }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={goal ? "Edit financial goal" : "New financial goal"}>
      {open && <GoalForm key={goal?.id ?? "new"} goal={goal} categories={categories} currency={currency} onDone={() => onOpenChange(false)} onDeleted={onDeleted} />}
    </Modal>
  );
}

function GoalForm({ goal, categories, currency, onDone, onDeleted }: { goal: FinancialGoalDTO | null; categories: Category[]; currency: string; onDone: () => void; onDeleted?: () => void }) {
  const { form, submit, pending, formError } = useServerForm({
    schema: financialGoalInputSchema,
    defaultValues: valuesFor(goal),
    action: saveFinancialGoalAction,
    successMessage: goal ? "Goal saved" : "Goal created",
    onSuccess: onDone,
  });
  const [deleting, startDelete] = React.useTransition();
  const { errors } = form.formState;
  const err = (k: string) => errors[k]?.message as string | undefined;

  const remove = () =>
    startDelete(async () => {
      const res = await deleteFinancialGoalAction(goal!.id);
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
        <Input {...describe("name", err("name"))} autoFocus placeholder="e.g. Emergency fund" {...form.register("name")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={`Target amount (${currency})`} htmlFor="targetAmount" error={err("targetAmount")}>
          <Input {...describe("targetAmount", err("targetAmount"))} inputMode="decimal" placeholder="0.00" {...form.register("targetAmount")} />
        </Field>
        <Field label="Target date" htmlFor="targetDate" error={err("targetDate")} hint="Optional.">
          <Input {...describe("targetDate", err("targetDate"), "hint")} type="date" {...form.register("targetDate")} />
        </Field>
        <Field label="Category" htmlFor="categoryId" error={err("categoryId")}>
          <OptionSelect {...describe("categoryId", err("categoryId"))} emptyLabel="No category" options={categories.map((c) => ({ value: c.id, label: c.name }))} {...form.register("categoryId")} />
        </Field>
        <Field label="Priority" htmlFor="priority" error={err("priority")}>
          <OptionSelect
            {...describe("priority", err("priority"))}
            options={[
              { value: "LOW", label: "Low" },
              { value: "MEDIUM", label: "Medium" },
              { value: "HIGH", label: "High" },
              { value: "URGENT", label: "Urgent" },
            ]}
            {...form.register("priority")}
          />
        </Field>
        <Field label="Status" htmlFor="status" error={err("status")} className="sm:col-span-2">
          <OptionSelect
            {...describe("status", err("status"))}
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "PAUSED", label: "Paused" },
              { value: "ACHIEVED", label: "Achieved" },
              { value: "CANCELLED", label: "Cancelled" },
            ]}
            {...form.register("status")}
          />
        </Field>
      </div>
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
