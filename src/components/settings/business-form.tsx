"use client";
import { Input, Textarea } from "@/components/ui/input";
import { Field, FormError, describe } from "@/components/forms/field";
import { useServerForm } from "@/hooks/use-server-form";
import { updateBusinessAction } from "@/modules/settings/actions";
import { businessSchema } from "@/modules/settings/schema";
import { SaveBar } from "./save-bar";

interface Props {
  business: { name: string | null; address: string | null; email: string | null; phone: string | null; website: string | null; taxId: string | null };
}

export function BusinessForm({ business: b }: Props) {
  const { form, submit, pending, formError } = useServerForm({
    schema: businessSchema,
    defaultValues: { name: b.name ?? "", address: b.address ?? "", email: b.email ?? "", phone: b.phone ?? "", website: b.website ?? "", taxId: b.taxId ?? "" },
    action: updateBusinessAction,
    successMessage: "Business details saved",
  });
  const { errors, isDirty } = form.formState;
  const err = (k: string) => errors[k]?.message as string | undefined;

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <FormError message={formError} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Business name" htmlFor="name" error={err("name")} className="sm:col-span-2">
          <Input {...describe("name", err("name"))} autoComplete="organization" {...form.register("name")} />
        </Field>
        <Field label="Business email" htmlFor="email" error={err("email")}>
          <Input {...describe("email", err("email"))} type="email" {...form.register("email")} />
        </Field>
        <Field label="Business phone" htmlFor="phone" error={err("phone")}>
          <Input {...describe("phone", err("phone"))} type="tel" {...form.register("phone")} />
        </Field>
        <Field label="Website" htmlFor="website" error={err("website")}>
          <Input {...describe("website", err("website"))} type="url" placeholder="https://" {...form.register("website")} />
        </Field>
        <Field label="Tax ID" htmlFor="taxId" error={err("taxId")} hint="Shown on invoices, e.g. VAT or BIN number.">
          <Input {...describe("taxId", err("taxId"), "hint")} {...form.register("taxId")} />
        </Field>
        <Field label="Address" htmlFor="address" error={err("address")} className="sm:col-span-2">
          <Textarea {...describe("address", err("address"))} rows={3} {...form.register("address")} />
        </Field>
      </div>
      <p className="rounded-control bg-surface-2 px-3 py-2.5 text-sm text-muted">Logo upload arrives with file storage in a later phase; invoices will use it then.</p>
      <SaveBar pending={pending} dirty={isDirty} />
    </form>
  );
}
