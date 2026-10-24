"use client";
import { HandCoins } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Field, FormError, describe } from "@/components/forms/field";
import { FormFooter } from "@/components/forms/form-footer";
import { OptionSelect } from "@/components/forms/selects";
import { useServerForm } from "@/hooks/use-server-form";
import { formatMoney, Money } from "@/lib/money";
import { recordPaymentAction } from "@/modules/payments/actions";
import { PAYMENT_METHODS, paymentInputSchema } from "@/modules/payments/schema";

const METHOD_LABEL: Record<string, string> = { CASH: "Cash", BANK_TRANSFER: "Bank transfer", PAYPAL: "PayPal", WISE: "Wise", STRIPE: "Stripe", OTHER: "Other" };

interface Account {
  id: string;
  name: string;
  currency: string;
}

export function RecordPaymentButton({ invoiceId, currency, balanceDue, accounts, today }: { invoiceId: string; currency: string; balanceDue: { minor: string; currency: string }; accounts: Account[]; today: string }) {
  const [open, setOpen] = React.useState(false);
  const matching = accounts.filter((a) => a.currency === currency);
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={matching.length === 0} title={matching.length === 0 ? `Add a ${currency} account first` : undefined}>
        <HandCoins className="size-4" aria-hidden /> Record payment
      </Button>
      <Modal open={open} onOpenChange={setOpen} title="Record payment" description={`Balance due: ${formatMoney(Money.fromDTO(balanceDue))}`}>
        {open && <PaymentForm invoiceId={invoiceId} currency={currency} accounts={matching} today={today} onDone={() => setOpen(false)} />}
      </Modal>
    </>
  );
}

function PaymentForm({ invoiceId, currency, accounts, today, onDone }: { invoiceId: string; currency: string; accounts: Account[]; today: string; onDone: () => void }) {
  const { form, submit, pending, formError } = useServerForm({
    schema: paymentInputSchema,
    defaultValues: { invoiceId, accountId: accounts[0]?.id ?? "", amount: "", date: today, method: "BANK_TRANSFER", reference: "", notes: "" },
    action: recordPaymentAction,
    successMessage: "Payment recorded",
    onSuccess: onDone,
  });
  const { errors } = form.formState;
  const err = (k: string) => errors[k]?.message as string | undefined;

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={formError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={`Amount (${currency})`} htmlFor="amount" error={err("amount")}>
          <Input {...describe("amount", err("amount"))} autoFocus inputMode="decimal" placeholder="0.00" {...form.register("amount")} />
        </Field>
        <Field label="Date" htmlFor="date" error={err("date")}>
          <Input {...describe("date", err("date"))} type="date" {...form.register("date")} />
        </Field>
        <Field label="Account" htmlFor="accountId" error={err("accountId")}>
          <OptionSelect {...describe("accountId", err("accountId"))} options={accounts.map((a) => ({ value: a.id, label: a.name }))} {...form.register("accountId")} />
        </Field>
        <Field label="Method" htmlFor="method" error={err("method")}>
          <OptionSelect {...describe("method", err("method"))} options={PAYMENT_METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m]! }))} {...form.register("method")} />
        </Field>
        <Field label="Reference" htmlFor="reference" error={err("reference")} hint="Optional." className="sm:col-span-2">
          <Input {...describe("reference", err("reference"), "hint")} {...form.register("reference")} />
        </Field>
      </div>
      <input type="hidden" {...form.register("invoiceId")} />
      <FormFooter pending={pending} onCancel={onDone} submitLabel="Record payment" />
    </form>
  );
}
