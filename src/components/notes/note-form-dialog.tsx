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
import { deleteNoteAction, saveNoteAction } from "@/modules/notes/actions";
import { noteInputSchema, type NoteFormValues } from "@/modules/notes/schema";
import type { NoteDTO } from "@/modules/notes/types";

interface Option {
  id: string;
  name: string;
}

function valuesFor(n: NoteDTO | null): NoteFormValues {
  if (!n) return { title: "", content: "", categoryId: "", goalId: "", tags: "", pinned: false };
  return { id: n.id, title: n.title, content: n.content, categoryId: n.categoryId ?? "", goalId: n.goalId ?? "", tags: n.tags.join(", "), pinned: n.pinned };
}

export function NoteFormDialog({ open, onOpenChange, note, categories, goals, onDeleted }: { open: boolean; onOpenChange: (o: boolean) => void; note: NoteDTO | null; categories: Option[]; goals: Option[]; onDeleted?: () => void }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={note ? "Edit note" : "New note"} className="max-w-3xl">
      {open && <NoteForm key={note?.id ?? "new"} note={note} categories={categories} goals={goals} onDone={() => onOpenChange(false)} onDeleted={onDeleted} />}
    </Modal>
  );
}

function NoteForm({ note, categories, goals, onDone, onDeleted }: { note: NoteDTO | null; categories: Option[]; goals: Option[]; onDone: () => void; onDeleted?: () => void }) {
  const { form, submit, pending, formError } = useServerForm({
    schema: noteInputSchema,
    defaultValues: valuesFor(note),
    action: saveNoteAction,
    successMessage: note ? "Note saved" : "Note added",
    onSuccess: onDone,
  });
  const [deleting, startDelete] = React.useTransition();
  const { errors } = form.formState;
  const err = (k: string) => errors[k]?.message as string | undefined;

  const remove = () =>
    startDelete(async () => {
      const res = await deleteNoteAction(note!.id);
      if (res.ok) {
        toast.success("Note deleted");
        onDone();
        onDeleted?.();
      } else toast.error(res.error.message);
    });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={formError} />
      <Field label="Title" htmlFor="title" error={err("title")}>
        <Input {...describe("title", err("title"))} autoFocus {...form.register("title")} />
      </Field>
      <Field label="Content" htmlFor="content" error={err("content")}>
        <Textarea {...describe("content", err("content"))} rows={8} {...form.register("content")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" htmlFor="categoryId" error={err("categoryId")}>
          <OptionSelect {...describe("categoryId", err("categoryId"))} emptyLabel="No category" options={categories.map((c) => ({ value: c.id, label: c.name }))} {...form.register("categoryId")} />
        </Field>
        <Field label="Related goal" htmlFor="goalId" error={err("goalId")}>
          <OptionSelect {...describe("goalId", err("goalId"))} emptyLabel="None" options={goals.map((g) => ({ value: g.id, label: g.name }))} {...form.register("goalId")} />
        </Field>
        <Field label="Tags" htmlFor="tags" error={err("tags")} hint="Separate with commas." className="sm:col-span-2">
          <Input {...describe("tags", err("tags"), "hint")} placeholder="ideas, meetings" {...form.register("tags")} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-[var(--primary)]" {...form.register("pinned")} />
        Pin to the top
      </label>
      <FormFooter
        pending={pending}
        onCancel={onDone}
        submitLabel={note ? "Save changes" : "Add note"}
        left={note && <ConfirmButton onConfirm={remove} loading={deleting} confirmLabel="Confirm delete">Delete</ConfirmButton>}
      />
    </form>
  );
}
