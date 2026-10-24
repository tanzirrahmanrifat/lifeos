"use client";
import * as React from "react";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Field, FormError, describe } from "@/components/forms/field";
import { FormFooter } from "@/components/forms/form-footer";
import { OptionSelect } from "@/components/forms/selects";
import { useServerForm } from "@/hooks/use-server-form";
import { saveTransferAction } from "@/modules/finance/actions";
import { transferInputSchema, type TransferFormValues } from "@/modules/finance/schema";
import type { AccountDTO } from "@/modules/finance/types";

function valuesFor(today: string): TransferFormValues {
  return { fromAccountId: "", toAccountId: "", amountFrom: "", amountTo: "", date: today, notes: "" };
}

export function TransferFormDialog({ open, onOpenChange, accounts, today }: { open: boolean; onOpenChange: (o: boolean) => void; accounts: AccountDTO[]; today: string }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Transfer money" description="Between two of your own accounts.">
      {open && <TransferForm accounts={accounts} today={today} onDone={() => onOpenChange(false)} />}
    </Modal>
  );
}

function TransferForm({ accounts, today, onDone }: { accounts: AccountDTO[]; today: string; onDone: () => void }) {
  const { form, submit, pending, formError } = useServerForm({
    schema: transferInputSchema,
    defaultValues: valuesFor(today),
    action: saveTransferAction,
    successMessage: "Transfer recorded",
    onSuccess: onDone,
  });
  const { errors } = form.formState;
  const err = (k: string) => errors[k]?.message as string | undefined;
  const fromId = form.watch("fromAccountId");
  const toId = form.watch("toAccountId");
  const amountFrom = form.watch("amountFrom");
  const from = accounts.find((a) => a.id === fromId);
  const to = accounts.find((a) => a.id === toId);
  const crossCurrency = from && to && from.balance.currency !== to.balance.currency;

  React.useEffect(() => {
    if (!crossCurrency) form.setValue("amountTo", amountFrom);
  }, [amountFrom, crossCurrency]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={formError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="From" htmlFor="fromAccountId" error={err("fromAccountId")}>
          <OptionSelect {...describe("fromAccountId", err("fromAccountId"))} emptyLabel="Choose an account" options={accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.balance.currency})` }))} {...form.register("fromAccountId")} />
        </Field>
        <Field label="To" htmlFor="toAccountId" error={err("toAccountId")}>
          <OptionSelect {...describe("toAccountId", err("toAccountId"))} emptyLabel="Choose an account" options={accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.balance.currency})` }))} {...form.register("toAccountId")} />
        </Field>
        <Field label={`Amount${from ? ` (${from.balance.currency})` : ""}`} htmlFor="amountFrom" error={err("amountFrom")}>
          <Input {...describe("amountFrom", err("amountFrom"))} autoFocus inputMode="decimal" placeholder="0.00" {...form.register("amountFrom")} />
        </Field>
        {crossCurrency && (
          <Field label={`Received (${to!.balance.currency})`} htmlFor="amountTo" error={err("amountTo")} hint="Different currencies — enter what arrives.">
            <Input {...describe("amountTo", err("amountTo"), "hint")} inputMode="decimal" placeholder="0.00" {...form.register("amountTo")} />
          </Field>
        )}
        <Field label="Date" htmlFor="date" error={err("date")}>
          <Input {...describe("date", err("date"))} type="date" {...form.register("date")} />
        </Field>
      </div>
      <Field label="Notes" htmlFor="notes" error={err("notes")}>
        <Textarea {...describe("notes", err("notes"))} rows={2} {...form.register("notes")} />
      </Field>
      <FormFooter pending={pending} onCancel={onDone} submitLabel="Transfer" />
    </form>
  );
}
