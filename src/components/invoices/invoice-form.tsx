"use client";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useFieldArray, useForm, type FieldValues, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field, FormError, describe } from "@/components/forms/field";
import { OptionSelect } from "@/components/forms/selects";
import { formatMoney, Money } from "@/lib/money";
import { saveInvoiceAction } from "@/modules/invoices/actions";
import { calcInvoice } from "@/modules/invoices/calc";
import { invoiceInputSchema, type InvoiceFormValues } from "@/modules/invoices/schema";
import type { InvoiceDTO } from "@/modules/invoices/types";

interface Client {
  id: string;
  name: string;
}
interface Project {
  id: string;
  name: string;
  clientId: string;
}

function valuesFor(inv: InvoiceDTO | null, defaults: { issueDate: string; dueDate: string; currency: string; notes: string; clientId?: string }): InvoiceFormValues {
  if (!inv) return { clientId: defaults.clientId ?? "", projectId: "", issueDate: defaults.issueDate, dueDate: defaults.dueDate, currency: defaults.currency, notes: defaults.notes, paymentTerms: "", items: [{ description: "", quantity: "1", rate: "", discountPercent: "0", taxPercent: "0" }] };
  return {
    id: inv.id,
    clientId: inv.clientId,
    projectId: inv.projectId ?? "",
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    currency: inv.currency,
    notes: inv.notes ?? "",
    paymentTerms: inv.paymentTerms ?? "",
    items: inv.items.map((i) => ({ id: i.id, description: i.description, quantity: i.quantity, rate: (Number(i.rate.minor) / 100).toString(), discountPercent: i.discountPercent, taxPercent: i.taxPercent })),
  };
}

export function InvoiceForm({ invoice, clients, projects, defaults }: { invoice: InvoiceDTO | null; clients: Client[]; projects: Project[]; defaults: { issueDate: string; dueDate: string; currency: string; notes: string; clientId?: string } }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [formError, setFormError] = React.useState<string | null>(null);
  const form = useForm<FieldValues>({ resolver: zodResolver(invoiceInputSchema) as unknown as Resolver<FieldValues>, defaultValues: valuesFor(invoice, defaults) as FieldValues });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const { errors } = form.formState;
  const err = (k: string) => (errors as Record<string, { message?: string } | undefined>)[k]?.message;
  const clientId = form.watch("clientId");
  const currency = form.watch("currency");
  const items = (form.watch("items") ?? []) as InvoiceFormValues["items"];
  const projectsForClient = projects.filter((p) => p.clientId === clientId);

  const itemsKey = JSON.stringify(items);
  const calc = React.useMemo(() => {
    try {
      return calcInvoice(
        items.map((i) => ({ description: i.description || "", quantity: i.quantity || "0", rate: i.rate || "0", discountPercent: Number(i.discountPercent) || 0, taxPercent: Number(i.taxPercent) || 0 })),
        currency || "USD",
      );
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- itemsKey is a stable stringified snapshot of items
  }, [itemsKey, currency]);

  const submit = form.handleSubmit(() => {
    setFormError(null);
    startTransition(async () => {
      const res = await saveInvoiceAction(form.getValues());
      if (res.ok) {
        toast.success(invoice ? "Invoice saved" : "Invoice created");
        router.push(`/invoices/${(res.data as { id: string }).id}`);
        router.refresh();
      } else {
        for (const [path, messages] of Object.entries(res.error.fieldErrors ?? {})) {
          if (path === "_form") continue;
          form.setError(path, { type: "server", message: messages[0] });
        }
        setFormError(res.error.message);
      }
    });
  });

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <FormError message={formError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client" htmlFor="clientId" error={err("clientId")}>
          <OptionSelect {...describe("clientId", err("clientId"))} emptyLabel="Choose a client" options={clients.map((c) => ({ value: c.id, label: c.name }))} {...form.register("clientId", { onChange: () => form.setValue("projectId", "") })} />
        </Field>
        <Field label="Project" htmlFor="projectId" error={err("projectId")} hint="Optional.">
          <OptionSelect {...describe("projectId", err("projectId"), "hint")} emptyLabel="No project" options={projectsForClient.map((p) => ({ value: p.id, label: p.name }))} {...form.register("projectId")} />
        </Field>
        <Field label="Issue date" htmlFor="issueDate" error={err("issueDate")}>
          <Input {...describe("issueDate", err("issueDate"))} type="date" {...form.register("issueDate")} />
        </Field>
        <Field label="Due date" htmlFor="dueDate" error={err("dueDate")}>
          <Input {...describe("dueDate", err("dueDate"))} type="date" {...form.register("dueDate")} />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Line items</p>
        <div className="space-y-3">
          {fields.map((f, i) => (
            <div key={f.id} className="grid grid-cols-12 gap-2 rounded-card border border-line p-3">
              <div className="col-span-12 sm:col-span-5">
                <Input aria-label="Description" placeholder="Description" {...form.register(`items.${i}.description` as const)} />
              </div>
              <div className="col-span-3 sm:col-span-2">
                <Input aria-label="Quantity" placeholder="Qty" inputMode="decimal" {...form.register(`items.${i}.quantity` as const)} />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <Input aria-label="Rate" placeholder="Rate" inputMode="decimal" {...form.register(`items.${i}.rate` as const)} />
              </div>
              <div className="col-span-4 sm:col-span-1">
                <Input aria-label="Discount %" placeholder="Disc %" inputMode="decimal" {...form.register(`items.${i}.discountPercent` as const)} />
              </div>
              <div className="col-span-4 sm:col-span-1">
                <Input aria-label="Tax %" placeholder="Tax %" inputMode="decimal" {...form.register(`items.${i}.taxPercent` as const)} />
              </div>
              <div className="col-span-1 flex items-center justify-end">
                <Button type="button" variant="ghost" size="icon" aria-label="Remove line" onClick={() => remove(i)} disabled={fields.length <= 1}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
              {calc?.lines[i] && (
                <p className="tabular col-span-12 text-right text-xs text-muted">{formatMoney(Money.of(calc.lines[i]!.lineTotalMinor, currency || "USD"))}</p>
              )}
            </div>
          ))}
        </div>
        {err("items") && (
          <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
            {err("items")}
          </p>
        )}
        <Button type="button" variant="secondary" className="mt-2" onClick={() => append({ description: "", quantity: "1", rate: "", discountPercent: "0", taxPercent: "0" })}>
          <Plus className="size-4" aria-hidden /> Add line
        </Button>
      </div>

      {calc && (
        <div className="ml-auto w-full max-w-xs space-y-1 rounded-card border border-line p-4 text-sm">
          <div className="flex justify-between text-muted">
            <span>Subtotal</span>
            <span className="tabular">{formatMoney(Money.of(calc.subtotalMinor, currency || "USD"))}</span>
          </div>
          {calc.discountMinor > 0n && (
            <div className="flex justify-between text-muted">
              <span>Discount</span>
              <span className="tabular">−{formatMoney(Money.of(calc.discountMinor, currency || "USD"))}</span>
            </div>
          )}
          {calc.taxMinor > 0n && (
            <div className="flex justify-between text-muted">
              <span>Tax</span>
              <span className="tabular">{formatMoney(Money.of(calc.taxMinor, currency || "USD"))}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-line pt-1.5 text-base font-semibold">
            <span>Total</span>
            <span className="tabular">{formatMoney(Money.of(calc.totalMinor, currency || "USD"))}</span>
          </div>
        </div>
      )}

      <Field label="Payment terms" htmlFor="paymentTerms" error={err("paymentTerms")}>
        <Textarea {...describe("paymentTerms", err("paymentTerms"))} rows={2} {...form.register("paymentTerms")} />
      </Field>
      <Field label="Notes" htmlFor="notes" error={err("notes")}>
        <Textarea {...describe("notes", err("notes"))} rows={2} {...form.register("notes")} />
      </Field>

      <div className="flex justify-end gap-2 border-t border-line pt-5">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {invoice ? "Save changes" : "Create invoice"}
        </Button>
      </div>
    </form>
  );
}
