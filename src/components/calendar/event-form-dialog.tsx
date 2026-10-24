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
import { deleteEventAction, saveEventAction } from "@/modules/calendar/actions";
import { eventInputSchema, type EventFormValues } from "@/modules/calendar/schema";
import type { EventDTO } from "@/modules/calendar/types";

function valuesFor(e: EventDTO | null, defaultDate: string): EventFormValues {
  if (!e) return { title: "", type: "PERSONAL", allDay: false, date: defaultDate, clientId: "", startTime: "09:00", endTime: "10:00", location: "", notes: "" };
  return { id: e.id, title: e.title, type: e.type, allDay: e.allDay, date: e.date, clientId: e.clientId ?? "", startTime: e.startTime ?? "", endTime: e.endTime ?? "", location: e.location ?? "", notes: e.notes ?? "" };
}

export function EventFormDialog({ open, onOpenChange, event, defaultDate, clients = [], onDeleted }: { open: boolean; onOpenChange: (o: boolean) => void; event: EventDTO | null; defaultDate: string; clients?: { id: string; name: string }[]; onDeleted?: () => void }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={event ? "Edit event" : "New event"}>
      {open && <EventForm key={event?.id ?? "new"} event={event} defaultDate={defaultDate} clients={clients} onDone={() => onOpenChange(false)} onDeleted={onDeleted} />}
    </Modal>
  );
}

function EventForm({ event, defaultDate, clients, onDone, onDeleted }: { event: EventDTO | null; defaultDate: string; clients: { id: string; name: string }[]; onDone: () => void; onDeleted?: () => void }) {
  const { form, submit, pending, formError } = useServerForm({
    schema: eventInputSchema,
    defaultValues: valuesFor(event, defaultDate),
    action: saveEventAction,
    successMessage: event ? "Event saved" : "Event added",
    onSuccess: onDone,
  });
  const [deleting, startDelete] = React.useTransition();
  const { errors } = form.formState;
  const err = (k: string) => errors[k]?.message as string | undefined;
  const allDay = form.watch("allDay");

  const remove = () =>
    startDelete(async () => {
      const res = await deleteEventAction(event!.id);
      if (res.ok) {
        toast.success("Event deleted");
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" htmlFor="type" error={err("type")}>
          <OptionSelect
            {...describe("type", err("type"))}
            options={[
              { value: "PERSONAL", label: "Personal" },
              { value: "MEETING", label: "Meeting" },
              { value: "DEADLINE", label: "Deadline" },
            ]}
            {...form.register("type")}
          />
        </Field>
        <Field label="Date" htmlFor="date" error={err("date")}>
          <Input {...describe("date", err("date"))} type="date" {...form.register("date")} />
        </Field>
      </div>
      {clients.length > 0 && (
        <Field label="Client" htmlFor="clientId" error={err("clientId")} hint="Optional — link this to a client meeting.">
          <OptionSelect {...describe("clientId", err("clientId"), "hint")} emptyLabel="No client" options={clients.map((c) => ({ value: c.id, label: c.name }))} {...form.register("clientId")} />
        </Field>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-[var(--primary)]" {...form.register("allDay")} />
        All day
      </label>
      {!allDay && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start time" htmlFor="startTime" error={err("startTime")}>
            <Input {...describe("startTime", err("startTime"))} type="time" {...form.register("startTime")} />
          </Field>
          <Field label="End time" htmlFor="endTime" error={err("endTime")} hint="Optional.">
            <Input {...describe("endTime", err("endTime"), "hint")} type="time" {...form.register("endTime")} />
          </Field>
        </div>
      )}
      <Field label="Location" htmlFor="location" error={err("location")} hint="Optional.">
        <Input {...describe("location", err("location"), "hint")} {...form.register("location")} />
      </Field>
      <Field label="Notes" htmlFor="notes" error={err("notes")}>
        <Textarea {...describe("notes", err("notes"))} rows={2} {...form.register("notes")} />
      </Field>
      <FormFooter
        pending={pending}
        onCancel={onDone}
        submitLabel={event ? "Save changes" : "Add event"}
        left={event && <ConfirmButton onConfirm={remove} loading={deleting} confirmLabel="Confirm delete">Delete</ConfirmButton>}
      />
    </form>
  );
}
