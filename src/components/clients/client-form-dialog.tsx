"use client";
import * as React from "react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Field, FormError, describe } from "@/components/forms/field";
import { FormFooter } from "@/components/forms/form-footer";
import { useServerForm } from "@/hooks/use-server-form";
import { deleteClientAction, saveClientAction } from "@/modules/clients/actions";
import { CLIENT_STATUSES, clientInputSchema, type ClientFormValues } from "@/modules/clients/schema";
import type { ClientDTO } from "@/modules/clients/types";

const STATUS_LABEL: Record<string, string> = { LEAD: "Lead", ACTIVE: "Active", INACTIVE: "Inactive", COMPLETED: "Completed" };

function valuesFor(c: ClientDTO | null): ClientFormValues {
  if (!c) return { name: "", company: "", email: "", phone: "", website: "", address: "", country: "", status: "LEAD", notes: "" };
  return { id: c.id, name: c.name, company: c.company ?? "", email: c.email ?? "", phone: c.phone ?? "", website: c.website ?? "", address: c.address ?? "", country: c.country ?? "", status: c.status, notes: c.notes ?? "" };
}

export function ClientFormDialog({ open, onOpenChange, client, onDeleted }: { open: boolean; onOpenChange: (o: boolean) => void; client: ClientDTO | null; onDeleted?: () => void }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={client ? "Edit client" : "New client"}>
      {open && <ClientForm key={client?.id ?? "new"} client={client} onDone={() => onOpenChange(false)} onDeleted={onDeleted} />}
    </Modal>
  );
}

function ClientForm({ client, onDone, onDeleted }: { client: ClientDTO | null; onDone: () => void; onDeleted?: () => void }) {
  const { form, submit, pending, formError } = useServerForm({ schema: clientInputSchema, defaultValues: valuesFor(client), action: saveClientAction, successMessage: client ? "Client saved" : "Client added", onSuccess: onDone });
  const [deleting, startDelete] = React.useTransition();
  const { errors } = form.formState;
  const err = (k: string) => errors[k]?.message as string | undefined;

  const remove = () =>
    startDelete(async () => {
      const res = await deleteClientAction(client!.id);
      if (res.ok) {
        toast.success("Client deleted");
        onDone();
        onDeleted?.();
      } else toast.error(res.error.message);
    });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={formError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" error={err("name")}>
          <Input {...describe("name", err("name"))} autoFocus {...form.register("name")} />
        </Field>
        <Field label="Company" htmlFor="company" error={err("company")}>
          <Input {...describe("company", err("company"))} {...form.register("company")} />
        </Field>
        <Field label="Email" htmlFor="email" error={err("email")}>
          <Input {...describe("email", err("email"))} type="email" {...form.register("email")} />
        </Field>
        <Field label="Phone" htmlFor="phone" error={err("phone")}>
          <Input {...describe("phone", err("phone"))} type="tel" {...form.register("phone")} />
        </Field>
        <Field label="Website" htmlFor="website" error={err("website")}>
          <Input {...describe("website", err("website"))} type="url" placeholder="https://" {...form.register("website")} />
        </Field>
        <Field label="Country" htmlFor="country" error={err("country")}>
          <Input {...describe("country", err("country"))} {...form.register("country")} />
        </Field>
        <Field label="Status" htmlFor="status" error={err("status")}>
          <Select {...describe("status", err("status"))} {...form.register("status")}>
            {CLIENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Address" htmlFor="address" error={err("address")} className="sm:col-span-2">
          <Textarea {...describe("address", err("address"))} rows={2} {...form.register("address")} />
        </Field>
      </div>
      <Field label="Notes" htmlFor="notes" error={err("notes")}>
        <Textarea {...describe("notes", err("notes"))} rows={2} {...form.register("notes")} />
      </Field>
      <FormFooter pending={pending} onCancel={onDone} submitLabel={client ? "Save changes" : "Add client"} left={client && <ConfirmButton onConfirm={remove} loading={deleting} confirmLabel="Confirm delete">Delete</ConfirmButton>} />
    </form>
  );
}
