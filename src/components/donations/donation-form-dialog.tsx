"use client";
import * as React from "react";
import { toast } from "sonner";
import { CategorySelect } from "@/components/forms/category-select";
import { CurrencyOptions } from "@/components/forms/currency-options";
import { Field, FormError, describe } from "@/components/forms/field";
import { FormFooter } from "@/components/forms/form-footer";
import { OptionSelect } from "@/components/forms/selects";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useServerForm } from "@/hooks/use-server-form";
import { Money } from "@/lib/money";
import { deleteDonationAction, saveDonationAction } from "@/modules/donations/actions";
import { donationInputSchema, type DonationFormValues } from "@/modules/donations/schema";
import type { DonationDTO } from "@/modules/donations/types";

export interface DonationAccountOption {
  id: string;
  name: string;
  currency: string;
}

function valuesFor(d: DonationDTO | null, defaults: { currency: string; today: string }): DonationFormValues {
  if (!d) return { recipient: "", categoryId: "", amount: "", currency: defaults.currency, date: defaults.today, accountId: "", notes: "" };
  return { id: d.id, recipient: d.recipient ?? "", categoryId: d.categoryId ?? "", amount: Money.fromDTO(d.amount).toMajorString(), currency: d.amount.currency, date: d.date, accountId: d.accountId ?? "", notes: d.notes ?? "" };
}

export function DonationFormDialog({
  open,
  onOpenChange,
  donation,
  categories,
  accounts,
  defaultCurrency,
  today,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  donation: DonationDTO | null;
  categories: { id: string; name: string }[];
  accounts: DonationAccountOption[];
  defaultCurrency: string;
  today: string;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={donation ? "Edit donation" : "New donation (দান)"}>
      {open && <DonationForm key={donation?.id ?? "new"} donation={donation} categories={categories} accounts={accounts} defaults={{ currency: defaultCurrency, today }} onDone={() => onOpenChange(false)} />}
    </Modal>
  );
}

function DonationForm({ donation, categories, accounts, defaults, onDone }: { donation: DonationDTO | null; categories: { id: string; name: string }[]; accounts: DonationAccountOption[]; defaults: { currency: string; today: string }; onDone: () => void }) {
  const { form, submit, pending, formError } = useServerForm({
    schema: donationInputSchema,
    defaultValues: valuesFor(donation, defaults),
    action: saveDonationAction,
    successMessage: donation ? "Donation saved" : "Donation recorded",
    onSuccess: onDone,
  });
  const [deleting, startDelete] = React.useTransition();
  const { errors } = form.formState;
  const err = (k: string) => errors[k]?.message as string | undefined;
  const currency: string = form.watch("currency");
  const accountId: string = form.watch("accountId") ?? "";
  const fromLoan = Boolean(donation?.loanId);
  const matching = accounts.filter((a) => a.currency === currency);

  React.useEffect(() => {
    if (accountId && !matching.some((a) => a.id === accountId)) form.setValue("accountId", "");
  }, [currency]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = () =>
    startDelete(async () => {
      const res = await deleteDonationAction(donation!.id);
      if (res.ok) {
        toast.success("Donation deleted");
        onDone();
      } else toast.error(res.error.message);
    });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={formError} />
      {fromLoan && <p className="rounded-control bg-surface-2 px-3 py-2 text-xs text-muted">Logged by forgiving a loan — the amount follows that loan. Undo the forgiveness on the loan to remove it.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {!fromLoan && (
          <>
            <Field label="Amount" htmlFor="amount" error={err("amount")}>
              <Input {...describe("amount", err("amount"))} autoFocus inputMode="decimal" placeholder="0.00" {...form.register("amount")} />
            </Field>
            <Field label="Currency" htmlFor="currency" error={err("currency")}>
              <Select {...describe("currency", err("currency"))} {...form.register("currency")}>
                <CurrencyOptions />
              </Select>
            </Field>
          </>
        )}
        <Field label="Type" htmlFor="categoryId" error={err("categoryId")} hint="Use + to add your own type.">
          <CategorySelect
            {...describe("categoryId", err("categoryId"), "hint")}
            type="DONATION"
            categories={categories}
            emptyLabel="No type"
            value={form.watch("categoryId") ?? ""}
            onValueChange={(v) => form.setValue("categoryId", v, { shouldDirty: true })}
          />
        </Field>
        <Field label="Date" htmlFor="date" error={err("date")}>
          <Input {...describe("date", err("date"))} type="date" {...form.register("date")} />
        </Field>
        <Field label="Given to" htmlFor="recipient" error={err("recipient")} hint="Optional — a person, mosque, charity…" className="sm:col-span-2">
          <Input {...describe("recipient", err("recipient"), "hint")} {...form.register("recipient")} />
        </Field>
        {!fromLoan &&
          (matching.length > 0 ? (
            <Field label="Paid from account" htmlFor="accountId" error={err("accountId")} hint="Optional. Choosing one records it as an expense and lowers that balance." className="sm:col-span-2">
              <OptionSelect {...describe("accountId", err("accountId"), "hint")} emptyLabel="Don't link to an account" options={matching.map((a) => ({ value: a.id, label: a.name }))} {...form.register("accountId")} />
            </Field>
          ) : (
            <p className="text-xs text-muted sm:col-span-2">You have no {currency} account, so this donation is recorded without changing any account balance.</p>
          ))}
      </div>
      <Field label="Notes" htmlFor="notes" error={err("notes")}>
        <Textarea {...describe("notes", err("notes"))} rows={2} {...form.register("notes")} />
      </Field>
      <FormFooter
        pending={pending}
        onCancel={onDone}
        submitLabel={donation ? "Save changes" : "Record donation"}
        left={donation && !fromLoan && <ConfirmButton onConfirm={remove} loading={deleting} confirmLabel="Confirm delete">Delete</ConfirmButton>}
      />
    </form>
  );
}
