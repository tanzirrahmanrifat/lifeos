"use client";
import * as React from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Field, FormError, describe } from "@/components/forms/field";
import { FormFooter } from "@/components/forms/form-footer";
import { OptionSelect } from "@/components/forms/selects";
import { useServerForm } from "@/hooks/use-server-form";
import { CURRENCIES } from "@/lib/money";
import { archiveAccountAction, deleteAccountAction, saveAccountAction } from "@/modules/finance/actions";
import { ACCOUNT_TYPES, accountInputSchema, type AccountFormValues } from "@/modules/finance/schema";
import type { AccountDTO } from "@/modules/finance/types";
import { ACCOUNT_TYPE_LABEL } from "./account-meta";

function valuesFor(a: AccountDTO | null): AccountFormValues {
  if (!a) return { name: "", type: "BANK", currency: "USD", openingBalance: "0", isSavings: false };
  return { id: a.id, name: a.name, type: a.type, currency: a.balance.currency, openingBalance: "0", isSavings: a.isSavings };
}

export function AccountFormDialog({ open, onOpenChange, account, hasActivity, onDeleted }: { open: boolean; onOpenChange: (o: boolean) => void; account: AccountDTO | null; hasActivity?: boolean; onDeleted?: () => void }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={account ? "Edit account" : "New account"} description={account ? undefined : "Add a place you keep or track money."}>
      {open && <AccountForm key={account?.id ?? "new"} account={account} hasActivity={hasActivity} onDone={() => onOpenChange(false)} onDeleted={onDeleted} />}
    </Modal>
  );
}

function AccountForm({ account, hasActivity, onDone, onDeleted }: { account: AccountDTO | null; hasActivity?: boolean; onDone: () => void; onDeleted?: () => void }) {
  const { form, submit, pending, formError } = useServerForm({
    schema: accountInputSchema,
    defaultValues: valuesFor(account),
    action: saveAccountAction,
    successMessage: account ? "Account saved" : "Account created",
    onSuccess: onDone,
  });
  const [busy, startTransition] = React.useTransition();
  const { errors } = form.formState;
  const err = (k: string) => errors[k]?.message as string | undefined;

  const archive = () =>
    startTransition(async () => {
      const res = await archiveAccountAction({ id: account!.id, archived: !account!.archived });
      if (res.ok) {
        toast.success(account!.archived ? "Account restored" : "Account archived");
        onDone();
      } else toast.error(res.error.message);
    });

  const remove = () =>
    startTransition(async () => {
      const res = await deleteAccountAction(account!.id);
      if (res.ok) {
        toast.success("Account deleted");
        onDone();
        onDeleted?.();
      } else toast.error(res.error.message);
    });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={formError} />
      <Field label="Name" htmlFor="name" error={err("name")}>
        <Input {...describe("name", err("name"))} autoFocus placeholder="e.g. Main bank account" {...form.register("name")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" htmlFor="type" error={err("type")}>
          <OptionSelect {...describe("type", err("type"))} options={ACCOUNT_TYPES.map((t) => ({ value: t, label: ACCOUNT_TYPE_LABEL[t]! }))} {...form.register("type")} />
        </Field>
        <Field label="Currency" htmlFor="currency" error={err("currency")} hint={hasActivity ? "Has transactions — currency is locked." : undefined}>
          <OptionSelect {...describe("currency", err("currency"), "hint")} disabled={hasActivity} options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))} {...form.register("currency")} />
        </Field>
        {!account && (
          <Field label="Opening balance" htmlFor="openingBalance" error={err("openingBalance")} className="sm:col-span-2">
            <Input {...describe("openingBalance", err("openingBalance"))} inputMode="decimal" placeholder="0.00" {...form.register("openingBalance")} />
          </Field>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-[var(--primary)]" {...form.register("isSavings")} />
        This is a savings account
      </label>
      <FormFooter
        pending={pending}
        onCancel={onDone}
        submitLabel={account ? "Save changes" : "Create account"}
        left={
          account && (
            <div className="flex gap-2">
              <button type="button" onClick={archive} disabled={busy} className="text-sm font-medium text-muted hover:text-foreground">
                {account.archived ? "Restore" : "Archive"}
              </button>
              {!hasActivity && (
                <ConfirmButton onConfirm={remove} loading={busy} confirmLabel="Confirm delete">
                  Delete
                </ConfirmButton>
              )}
            </div>
          )
        }
      />
    </form>
  );
}
