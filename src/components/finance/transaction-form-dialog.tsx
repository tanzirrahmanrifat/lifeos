"use client";
import * as React from "react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Field, FormError, describe } from "@/components/forms/field";
import { FormFooter } from "@/components/forms/form-footer";
import { CategorySelect } from "@/components/forms/category-select";
import { OptionSelect } from "@/components/forms/selects";
import { useServerForm } from "@/hooks/use-server-form";
import { deleteTransactionAction, saveTransactionAction } from "@/modules/finance/actions";
import { transactionInputSchema, type TransactionFormValues } from "@/modules/finance/schema";
import type { TransactionDTO } from "@/modules/finance/types";

interface Option {
  id: string;
  name: string;
}

function valuesFor(t: TransactionDTO | null, defaults: { type: "INCOME" | "EXPENSE"; accountId?: string; date: string }): TransactionFormValues {
  if (!t) return { type: defaults.type, accountId: defaults.accountId ?? "", amount: "", date: defaults.date, categoryId: "", vendor: "", source: "", notes: "" };
  return { id: t.id, type: t.type as "INCOME" | "EXPENSE", accountId: t.accountId, amount: t.amount.minor === "0" ? "" : (Number(t.amount.minor) / 100).toFixed(2), date: t.date, categoryId: t.categoryId ?? "", vendor: t.vendor ?? "", source: t.source ?? "", notes: t.notes ?? "" };
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  transaction,
  accounts,
  incomeCategories,
  expenseCategories,
  defaultType,
  defaultAccountId,
  defaultDate,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  transaction: TransactionDTO | null;
  accounts: Option[];
  incomeCategories: Option[];
  expenseCategories: Option[];
  defaultType?: "INCOME" | "EXPENSE";
  defaultAccountId?: string;
  defaultDate: string;
  onDeleted?: () => void;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={transaction ? "Edit transaction" : "Add transaction"}>
      {open && (
        <TransactionForm
          key={transaction?.id ?? "new"}
          transaction={transaction}
          accounts={accounts}
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
          defaults={{ type: defaultType ?? "EXPENSE", accountId: defaultAccountId, date: defaultDate }}
          onDone={() => onOpenChange(false)}
          onDeleted={onDeleted}
        />
      )}
    </Modal>
  );
}

function TransactionForm({
  transaction,
  accounts,
  incomeCategories,
  expenseCategories,
  defaults,
  onDone,
  onDeleted,
}: {
  transaction: TransactionDTO | null;
  accounts: Option[];
  incomeCategories: Option[];
  expenseCategories: Option[];
  defaults: { type: "INCOME" | "EXPENSE"; accountId?: string; date: string };
  onDone: () => void;
  onDeleted?: () => void;
}) {
  const { form, submit, pending, formError } = useServerForm({
    schema: transactionInputSchema,
    defaultValues: valuesFor(transaction, defaults),
    action: saveTransactionAction,
    successMessage: transaction ? "Transaction saved" : "Transaction added",
    onSuccess: onDone,
  });
  const [deleting, startDelete] = React.useTransition();
  const { errors } = form.formState;
  const err = (k: string) => errors[k]?.message as string | undefined;
  const type = form.watch("type");
  const categories = type === "INCOME" ? incomeCategories : expenseCategories;

  const remove = () =>
    startDelete(async () => {
      const res = await deleteTransactionAction(transaction!.id);
      if (res.ok) {
        toast.success("Transaction deleted");
        onDone();
        onDeleted?.();
      } else toast.error(res.error.message);
    });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={formError} />
      <div role="tablist" className="flex rounded-control bg-surface-2 p-1">
        {(["EXPENSE", "INCOME"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={type === t}
            onClick={() => {
              if (t !== type) form.setValue("categoryId", "", { shouldDirty: true }); // income and expense categories are separate lists
              form.setValue("type", t, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
            }}
            className={`min-h-10 flex-1 rounded-[0.5rem] text-sm font-medium transition-colors ${type === t ? "bg-surface shadow-sm" : "text-muted"}`}
          >
            {t === "EXPENSE" ? "Expense" : "Income"}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount" htmlFor="amount" error={err("amount")}>
          <Input {...describe("amount", err("amount"))} autoFocus inputMode="decimal" placeholder="0.00" {...form.register("amount")} />
        </Field>
        <Field label="Date" htmlFor="date" error={err("date")}>
          <Input {...describe("date", err("date"))} type="date" {...form.register("date")} />
        </Field>
        <Field label="Account" htmlFor="accountId" error={err("accountId")}>
          <OptionSelect {...describe("accountId", err("accountId"))} emptyLabel="Choose an account" options={accounts.map((a) => ({ value: a.id, label: a.name }))} {...form.register("accountId")} />
        </Field>
        <Field label="Category" htmlFor="categoryId" error={err("categoryId")}>
          <CategorySelect
            key={type}
            {...describe("categoryId", err("categoryId"))}
            type={type === "INCOME" ? "INCOME" : "EXPENSE"}
            categories={categories}
            value={form.watch("categoryId") ?? ""}
            onValueChange={(v) => form.setValue("categoryId", v, { shouldDirty: true })}
          />
        </Field>
        {type === "EXPENSE" ? (
          <Field label="Vendor" htmlFor="vendor" error={err("vendor")} hint="Optional." className="sm:col-span-2">
            <Input {...describe("vendor", err("vendor"), "hint")} {...form.register("vendor")} />
          </Field>
        ) : (
          <Field label="Source" htmlFor="source" error={err("source")} hint="Optional — who it's from." className="sm:col-span-2">
            <Input {...describe("source", err("source"), "hint")} {...form.register("source")} />
          </Field>
        )}
      </div>
      <Field label="Notes" htmlFor="notes" error={err("notes")}>
        <Textarea {...describe("notes", err("notes"))} rows={2} {...form.register("notes")} />
      </Field>

      <FormFooter
        pending={pending}
        onCancel={onDone}
        submitLabel={transaction ? "Save changes" : "Add transaction"}
        left={transaction && <ConfirmButton onConfirm={remove} loading={deleting} confirmLabel="Confirm delete">Delete</ConfirmButton>}
      />
    </form>
  );
}
