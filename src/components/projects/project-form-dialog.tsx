"use client";
import * as React from "react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Field, FormError, describe } from "@/components/forms/field";
import { FormFooter } from "@/components/forms/form-footer";
import { OptionSelect } from "@/components/forms/selects";
import { useServerForm } from "@/hooks/use-server-form";
import { deleteProjectAction, saveProjectAction } from "@/modules/projects/actions";
import { PROJECT_STATUSES, projectInputSchema, type ProjectFormValues } from "@/modules/projects/schema";
import type { ProjectDTO } from "@/modules/projects/types";

const STATUS_LABEL: Record<string, string> = { PLANNING: "Planning", ACTIVE: "Active", ON_HOLD: "On hold", COMPLETED: "Completed", CANCELLED: "Cancelled" };

interface Client {
  id: string;
  name: string;
}

function valuesFor(p: ProjectDTO | null, defaultClientId: string, currency: string): ProjectFormValues {
  if (!p) return { clientId: defaultClientId, name: "", description: "", startDate: "", deadline: "", budget: "", currency, status: "PLANNING", progress: 0, notes: "" };
  return { id: p.id, clientId: p.clientId, name: p.name, description: p.description ?? "", startDate: p.startDate ?? "", deadline: p.deadline ?? "", budget: p.budget ? (Number(p.budget.minor) / 100).toFixed(2) : "", currency: p.budget?.currency ?? currency, status: p.status, progress: p.progress, notes: p.notes ?? "" };
}

export function ProjectFormDialog({ open, onOpenChange, project, clients, defaultClientId, currency, onDeleted }: { open: boolean; onOpenChange: (o: boolean) => void; project: ProjectDTO | null; clients: Client[]; defaultClientId?: string; currency: string; onDeleted?: () => void }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={project ? "Edit project" : "New project"}>
      {open && <ProjectForm key={project?.id ?? "new"} project={project} clients={clients} defaultClientId={defaultClientId ?? ""} currency={currency} onDone={() => onOpenChange(false)} onDeleted={onDeleted} />}
    </Modal>
  );
}

function ProjectForm({ project, clients, defaultClientId, currency, onDone, onDeleted }: { project: ProjectDTO | null; clients: Client[]; defaultClientId: string; currency: string; onDone: () => void; onDeleted?: () => void }) {
  const { form, submit, pending, formError } = useServerForm({ schema: projectInputSchema, defaultValues: valuesFor(project, defaultClientId, currency), action: saveProjectAction, successMessage: project ? "Project saved" : "Project created", onSuccess: onDone });
  const [deleting, startDelete] = React.useTransition();
  const { errors } = form.formState;
  const err = (k: string) => errors[k]?.message as string | undefined;

  const remove = () =>
    startDelete(async () => {
      const res = await deleteProjectAction(project!.id);
      if (res.ok) {
        toast.success("Project deleted");
        onDone();
        onDeleted?.();
      } else toast.error(res.error.message);
    });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={formError} />
      <Field label="Name" htmlFor="name" error={err("name")}>
        <Input {...describe("name", err("name"))} autoFocus {...form.register("name")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client" htmlFor="clientId" error={err("clientId")}>
          <OptionSelect {...describe("clientId", err("clientId"))} emptyLabel="Choose a client" options={clients.map((c) => ({ value: c.id, label: c.name }))} {...form.register("clientId")} />
        </Field>
        <Field label="Status" htmlFor="status" error={err("status")}>
          <OptionSelect {...describe("status", err("status"))} options={PROJECT_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s]! }))} {...form.register("status")} />
        </Field>
        <Field label="Start date" htmlFor="startDate" error={err("startDate")} hint="Optional.">
          <Input {...describe("startDate", err("startDate"), "hint")} type="date" {...form.register("startDate")} />
        </Field>
        <Field label="Deadline" htmlFor="deadline" error={err("deadline")} hint="Optional.">
          <Input {...describe("deadline", err("deadline"), "hint")} type="date" {...form.register("deadline")} />
        </Field>
        <Field label={`Budget (${currency})`} htmlFor="budget" error={err("budget")} hint="Optional.">
          <Input {...describe("budget", err("budget"), "hint")} inputMode="decimal" placeholder="0.00" {...form.register("budget")} />
        </Field>
        <Field label="Progress" htmlFor="progress" error={err("progress")}>
          <div className="flex items-center gap-3 pt-2">
            <input type="range" min={0} max={100} className="flex-1 accent-[var(--primary)]" {...form.register("progress")} />
            <span className="tabular w-12 text-right text-sm font-medium">{form.watch("progress")}%</span>
          </div>
        </Field>
      </div>
      <input type="hidden" {...form.register("currency")} />
      <Field label="Description" htmlFor="description" error={err("description")}>
        <Textarea {...describe("description", err("description"))} rows={2} {...form.register("description")} />
      </Field>
      <Field label="Notes" htmlFor="notes" error={err("notes")}>
        <Textarea {...describe("notes", err("notes"))} rows={2} {...form.register("notes")} />
      </Field>
      <FormFooter pending={pending} onCancel={onDone} submitLabel={project ? "Save changes" : "Create project"} left={project && <ConfirmButton onConfirm={remove} loading={deleting} confirmLabel="Confirm delete">Delete</ConfirmButton>} />
    </form>
  );
}
