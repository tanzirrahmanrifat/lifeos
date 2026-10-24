"use client";
import * as React from "react";
import { toast } from "sonner";
import { CurrencyOptions } from "@/components/forms/currency-options";
import { Field, FormError, describe } from "@/components/forms/field";
import { FormFooter } from "@/components/forms/form-footer";
import { OptionSelect } from "@/components/forms/selects";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useServerForm } from "@/hooks/use-server-form";
import { formatIsoDate } from "@/lib/dates";
import { formatMoney, Money } from "@/lib/money";
import { deleteLoanAction, saveLoanAction } from "@/modules/loans/actions";
import { loanInputSchema, type LoanFormValues } from "@/modules/loans/schema";
import type { LoanDTO } from "@/modules/loans/types";
import { KIND_LABEL } from "./loan-meta";

export interface LoanAccountOption {
  id: string;
  name: string;
  currency: string;
}

type Direction = "LENT" | "BORROWED";

function valuesFor(l: LoanDTO | null, defaults: { direction: Direction; currency: string; today: string }): LoanFormValues {
  if (!l) return { direction: defaults.direction, kind: "STANDARD", personName: "", personPhone: "", amount: "", currency: defaults.currency, date: defaults.today, dueDate: "", accountId: "", notes: "" };
  return {
    id: l.id,
    direction: l.direction,
    kind: l.kind,
    personName: l.personName,
    personPhone: l.personPhone ?? "",
    amount: Money.fromDTO(l.principal).toMajorString(),
    currency: l.principal.currency,
    date: l.date,
    dueDate: l.dueDate ?? "",
    accountId: l.accountId ?? "",
    notes: l.notes ?? "",
  };
}

export function LoanFormDialog({
  open,
  onOpenChange,
  loan,
  accounts,
  defaultDirection = "LENT",
  defaultCurrency,
  today,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  loan: LoanDTO | null;
  accounts: LoanAccountOption[];
  defaultDirection?: Direction;
  defaultCurrency: string;
  today: string;
  onDeleted?: () => void;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={loan ? "Edit loan" : "New loan (ধার / কর্জ)"}>
      {open && (
        <LoanForm
          key={loan?.id ?? "new"}
          loan={loan}
          accounts={accounts}
          defaults={{ direction: defaultDirection, currency: defaultCurrency, today }}
          onDone={() => onOpenChange(false)}
          onDeleted={onDeleted}
        />
      )}
    </Modal>
  );
}

function LoanForm({ loan, accounts, defaults, onDone, onDeleted }: { loan: LoanDTO | null; accounts: LoanAccountOption[]; defaults: { direction: Direction; currency: string; today: string }; onDone: () => void; onDeleted?: () => void }) {
  const { form, submit, pending, formError } = useServerForm({
    schema: loanInputSchema,
    defaultValues: valuesFor(loan, defaults),
    action: saveLoanAction,
    successMessage: loan ? "Loan saved" : "Loan added",
    onSuccess: onDone,
  });
  const [deleting, startDelete] = React.useTransition();
  const { errors } = form.formState;
  const err = (k: string) => errors[k]?.message as string | undefined;
  const direction: Direction = form.watch("direction");
  const currency: string = form.watch("currency");
  const accountId: string = form.watch("accountId") ?? "";
  const locked = loan?.locked ?? false;
  const matching = accounts.filter((a) => a.currency === currency);

  // An account only works in its own currency; drop the choice if the currency no longer matches.
  React.useEffect(() => {
    if (accountId && !matching.some((a) => a.id === accountId)) form.setValue("accountId", "");
  }, [currency]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = () =>
    startDelete(async () => {
      const res = await deleteLoanAction(loan!.id);
      if (res.ok) {
        toast.success("Loan deleted");
        onDone();
        onDeleted?.();
      } else toast.error(res.error.message);
    });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={formError} />
      <div role="tablist" aria-label="Who gave the money" className="flex rounded-control bg-surface-2 p-1">
        {(["LENT", "BORROWED"] as const).map((d) => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={direction === d}
            disabled={locked}
            onClick={() => form.setValue("direction", d, { shouldDirty: true })}
            className={`min-h-10 flex-1 rounded-[0.5rem] px-2 text-sm font-medium transition-colors disabled:opacity-60 ${direction === d ? "bg-surface shadow-sm" : "text-muted"}`}
          >
            {d === "LENT" ? "I gave money (পাবো)" : "I took money (দেবো)"}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={direction === "LENT" ? "Given to" : "Taken from"} htmlFor="personName" error={err("personName")}>
          <Input {...describe("personName", err("personName"))} autoFocus placeholder="Name" autoComplete="off" {...form.register("personName")} />
        </Field>
        <Field label="Phone" htmlFor="personPhone" error={err("personPhone")} hint="Optional.">
          <Input {...describe("personPhone", err("personPhone"), "hint")} type="tel" inputMode="tel" placeholder="+8801…" {...form.register("personPhone")} />
        </Field>
        <Field label="Type" htmlFor="kind" error={err("kind")} hint="Qard al-Hasan is an interest-free loan." className="sm:col-span-2">
          <OptionSelect {...describe("kind", err("kind"), "hint")} options={(["STANDARD", "QARD_HASAN"] as const).map((k) => ({ value: k, label: KIND_LABEL[k] }))} {...form.register("kind")} />
        </Field>
        {locked && loan ? (
          <div className="rounded-control border border-line bg-surface-2/60 p-3 text-sm sm:col-span-2">
            <p className="font-medium">
              {formatMoney(Money.fromDTO(loan.principal))} · {formatIsoDate(loan.date)}
              {loan.accountName ? ` · ${loan.accountName}` : ""}
            </p>
            <p className="mt-1 text-xs text-muted">Amount, currency, date and account are locked because this loan already has repayments. Delete the repayments first to change them.</p>
          </div>
        ) : (
          <>
            <Field label="Amount" htmlFor="amount" error={err("amount")}>
              <Input {...describe("amount", err("amount"))} inputMode="decimal" placeholder="0.00" {...form.register("amount")} />
            </Field>
            <Field label="Currency" htmlFor="currency" error={err("currency")}>
              <Select {...describe("currency", err("currency"))} {...form.register("currency")}>
                <CurrencyOptions />
              </Select>
            </Field>
            <Field label="Date" htmlFor="date" error={err("date")}>
              <Input {...describe("date", err("date"))} type="date" {...form.register("date")} />
            </Field>
          </>
        )}
        <Field label="Due date" htmlFor="dueDate" error={err("dueDate")} hint="Optional — when it should be repaid.">
          <Input {...describe("dueDate", err("dueDate"), "hint")} type="date" {...form.register("dueDate")} />
        </Field>
        {!locked &&
          (matching.length > 0 ? (
            <Field label={direction === "LENT" ? "Paid from account" : "Received into account"} htmlFor="accountId" error={err("accountId")} hint="Optional. Choosing one updates that account's balance." className="sm:col-span-2">
              <OptionSelect {...describe("accountId", err("accountId"), "hint")} emptyLabel="Don't link to an account" options={matching.map((a) => ({ value: a.id, label: a.name }))} {...form.register("accountId")} />
            </Field>
          ) : (
            <p className="text-xs text-muted sm:col-span-2">You have no {currency} account, so this loan is tracked without changing any account balance.</p>
          ))}
      </div>
      <Field label="Notes" htmlFor="notes" error={err("notes")}>
        <Textarea {...describe("notes", err("notes"))} rows={2} {...form.register("notes")} />
      </Field>

      <FormFooter
        pending={pending}
        onCancel={onDone}
        submitLabel={loan ? "Save changes" : "Add loan"}
        left={loan && <ConfirmButton onConfirm={remove} loading={deleting} confirmLabel="Confirm delete">Delete</ConfirmButton>}
      />
    </form>
  );
}
