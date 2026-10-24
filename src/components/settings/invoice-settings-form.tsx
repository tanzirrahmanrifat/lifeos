"use client";
import { Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Field, FormError, describe } from "@/components/forms/field";
import { useServerForm } from "@/hooks/use-server-form";
import { formatInvoiceNumber } from "@/modules/settings/invoice-number";
import { updateInvoiceSettingsAction } from "@/modules/settings/actions";
import { invoiceSettingsSchema } from "@/modules/settings/schema";
import { SaveBar } from "./save-bar";

interface Props {
  settings: {
    invoicePrefix: string;
    invoiceNextNumber: number;
    invoiceNumberPadding: number;
    invoiceIncludeYear: boolean;
    invoiceResetYearly: boolean;
    defaultPaymentTermsDays: number;
    defaultTaxBps: number;
    defaultInvoiceNotes: string | null;
  };
}

/** 1850 → "18.5", 0 → "0". */
const bpsToPercent = (bps: number) => (bps / 100).toString();

export function InvoiceSettingsForm({ settings: s }: Props) {
  const { form, submit, pending, formError } = useServerForm({
    schema: invoiceSettingsSchema,
    defaultValues: {
      invoicePrefix: s.invoicePrefix,
      invoiceNextNumber: s.invoiceNextNumber,
      invoiceNumberPadding: s.invoiceNumberPadding,
      invoiceIncludeYear: s.invoiceIncludeYear,
      invoiceResetYearly: s.invoiceResetYearly,
      defaultPaymentTermsDays: s.defaultPaymentTermsDays,
      defaultTaxPercent: bpsToPercent(s.defaultTaxBps),
      defaultInvoiceNotes: s.defaultInvoiceNotes ?? "",
    },
    action: updateInvoiceSettingsAction,
    successMessage: "Invoice settings saved",
  });
  const { errors, isDirty } = form.formState;
  const err = (k: string) => errors[k]?.message as string | undefined;

  const [prefix, next, padding, includeYear, resetYearly] = form.watch([
    "invoicePrefix",
    "invoiceNextNumber",
    "invoiceNumberPadding",
    "invoiceIncludeYear",
    "invoiceResetYearly",
  ]);
  const preview = formatInvoiceNumber(
    { prefix: String(prefix || "INV"), includeYear: Boolean(includeYear), padding: Math.min(8, Math.max(1, Number(padding) || 4)) },
    new Date().getFullYear(),
    Math.max(1, Number(next) || 1),
  );

  const toggle = (name: "invoiceIncludeYear" | "invoiceResetYearly", label: string, hint: string, value: boolean) => (
    <div className="flex items-center justify-between gap-4 rounded-control border border-line px-4 py-3">
      <div>
        <Label htmlFor={name}>{label}</Label>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      <Switch id={name} checked={value} onCheckedChange={(v) => form.setValue(name, v, { shouldDirty: true })} />
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <FormError message={formError} />

      <div className="rounded-card bg-primary-soft px-5 py-4">
        <p className="text-sm text-primary">Your next invoice number</p>
        <p className="tabular mt-1 text-2xl font-semibold text-primary" aria-live="polite">
          {preview}
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Prefix" htmlFor="invoicePrefix" error={err("invoicePrefix")}>
          <Input {...describe("invoicePrefix", err("invoicePrefix"))} maxLength={10} {...form.register("invoicePrefix")} />
        </Field>
        <Field label="Next number" htmlFor="invoiceNextNumber" error={err("invoiceNextNumber")}>
          <Input {...describe("invoiceNextNumber", err("invoiceNextNumber"))} type="number" inputMode="numeric" min={1} {...form.register("invoiceNextNumber")} />
        </Field>
        <Field label="Digits" htmlFor="invoiceNumberPadding" error={err("invoiceNumberPadding")} hint="Zero-padded length.">
          <Input {...describe("invoiceNumberPadding", err("invoiceNumberPadding"), "hint")} type="number" inputMode="numeric" min={1} max={8} {...form.register("invoiceNumberPadding")} />
        </Field>
      </div>

      <div className="space-y-3">
        {toggle("invoiceIncludeYear", "Include the year", "INV-2026-0001 instead of INV-0001.", Boolean(includeYear))}
        {toggle("invoiceResetYearly", "Restart numbering each year", "The counter goes back to 1 every January.", Boolean(resetYearly))}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Default payment terms (days)" htmlFor="defaultPaymentTermsDays" error={err("defaultPaymentTermsDays")} hint="Due date = issue date + this many days.">
          <Input {...describe("defaultPaymentTermsDays", err("defaultPaymentTermsDays"), "hint")} type="number" inputMode="numeric" min={0} max={365} {...form.register("defaultPaymentTermsDays")} />
        </Field>
        <Field label="Default tax rate (%)" htmlFor="defaultTaxPercent" error={err("defaultTaxPercent")} hint="Pre-filled on new invoices; editable per invoice.">
          <Input {...describe("defaultTaxPercent", err("defaultTaxPercent"), "hint")} inputMode="decimal" {...form.register("defaultTaxPercent")} />
        </Field>
        <Field label="Default invoice notes" htmlFor="defaultInvoiceNotes" error={err("defaultInvoiceNotes")} className="sm:col-span-2">
          <Textarea {...describe("defaultInvoiceNotes", err("defaultInvoiceNotes"))} rows={3} placeholder="Thank you for your business." {...form.register("defaultInvoiceNotes")} />
        </Field>
      </div>
      <SaveBar pending={pending} dirty={isDirty} />
    </form>
  );
}
