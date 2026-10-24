"use client";
import * as React from "react";
import { toast } from "sonner";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Field, FormError, describe } from "@/components/forms/field";
import { FormFooter } from "@/components/forms/form-footer";
import { OptionSelect } from "@/components/forms/selects";
import { useServerForm } from "@/hooks/use-server-form";
import { cn } from "@/lib/utils";
import { deleteHabitAction, saveHabitAction } from "@/modules/habits/actions";
import { WEEKDAY_ORDER, weekdayShort } from "@/modules/habits/labels";
import { HABIT_COLORS, HABIT_ICONS, habitInputSchema, type HabitFormValues } from "@/modules/habits/schema";
import type { HabitDTO } from "@/modules/habits/types";
import { HabitIcon } from "./icons";

interface Category {
  id: string;
  name: string;
}

function valuesFor(h: HabitDTO | null, today: string): HabitFormValues {
  if (!h) {
    return { name: "", description: "", frequency: "DAILY", weekdays: [1, 2, 3, 4, 5], targetPerPeriod: 3, startDate: today, endDate: "", reminderTime: "", categoryId: "", color: HABIT_COLORS[0], icon: "check" };
  }
  return {
    id: h.id,
    name: h.name,
    description: h.description ?? "",
    frequency: h.frequency,
    weekdays: h.weekdays.length ? h.weekdays : [1, 2, 3, 4, 5],
    targetPerPeriod: h.targetPerPeriod > 1 ? h.targetPerPeriod : 3,
    startDate: h.startDate,
    endDate: h.endDate ?? "",
    reminderTime: h.reminderTime ?? "",
    categoryId: h.categoryId ?? "",
    color: h.color,
    icon: h.icon as HabitFormValues["icon"],
  };
}

export function HabitFormDialog({ open, onOpenChange, habit, categories, today, onDeleted }: { open: boolean; onOpenChange: (o: boolean) => void; habit: HabitDTO | null; categories: Category[]; today: string; onDeleted?: () => void }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={habit ? "Edit habit" : "New habit"} description={habit ? undefined : "Something you want to do regularly. You can change all of this later."}>
      {open && <HabitForm key={habit?.id ?? "new"} habit={habit} categories={categories} today={today} onDone={() => onOpenChange(false)} onDeleted={onDeleted} />}
    </Modal>
  );
}

function HabitForm({ habit, categories, today, onDone, onDeleted }: { habit: HabitDTO | null; categories: Category[]; today: string; onDone: () => void; onDeleted?: () => void }) {
  const { form, submit, pending, formError } = useServerForm({
    schema: habitInputSchema,
    defaultValues: valuesFor(habit, today),
    action: saveHabitAction,
    successMessage: habit ? "Habit saved" : "Habit created",
    onSuccess: onDone,
  });
  const [deleting, startDelete] = React.useTransition();
  const { errors } = form.formState;
  const err = (k: string) => errors[k]?.message as string | undefined;
  const frequency = form.watch("frequency");
  const weekdays: number[] = ((form.watch("weekdays") ?? []) as unknown[]).map(Number);
  const color = form.watch("color");
  const icon = form.watch("icon");

  const toggleDay = (d: number) => {
    const next = weekdays.includes(d) ? weekdays.filter((x) => x !== d) : [...weekdays, d];
    form.setValue("weekdays", next, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
  };

  const remove = () =>
    startDelete(async () => {
      const res = await deleteHabitAction(habit!.id);
      if (res.ok) {
        toast.success("Habit deleted");
        onDone();
        onDeleted?.();
      } else toast.error(res.error.message);
    });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={formError} />
      <Field label="Name" htmlFor="name" error={err("name")}>
        <Input {...describe("name", err("name"))} autoFocus placeholder="e.g. Read for 20 minutes" {...form.register("name")} />
      </Field>
      <Field label="Description" htmlFor="description" error={err("description")}>
        <Textarea {...describe("description", err("description"))} rows={2} {...form.register("description")} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="How often" htmlFor="frequency" error={err("frequency")}>
          <OptionSelect
            {...describe("frequency", err("frequency"))}
            options={[
              { value: "DAILY", label: "Every day" },
              { value: "WEEKDAYS", label: "Specific days of the week" },
              { value: "WEEKLY", label: "A number of times a week" },
              { value: "MONTHLY", label: "A number of times a month" },
            ]}
            {...form.register("frequency")}
          />
        </Field>
        {(frequency === "WEEKLY" || frequency === "MONTHLY") && (
          <Field label={frequency === "WEEKLY" ? "Times per week" : "Times per month"} htmlFor="targetPerPeriod" error={err("targetPerPeriod")}>
            <Input {...describe("targetPerPeriod", err("targetPerPeriod"))} type="number" min={1} max={frequency === "WEEKLY" ? 7 : 31} inputMode="numeric" {...form.register("targetPerPeriod")} />
          </Field>
        )}
      </div>

      {frequency === "WEEKDAYS" && (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">On these days</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_ORDER.map((d) => {
              const on = weekdays.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggleDay(d)}
                  className={cn("min-h-11 min-w-14 rounded-control border px-3 text-sm transition-colors md:min-h-10", on ? "border-primary bg-primary-soft font-medium text-primary" : "border-line text-muted hover:bg-surface-2")}
                >
                  {weekdayShort(d)}
                </button>
              );
            })}
          </div>
          {err("weekdays") && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
              {err("weekdays")}
            </p>
          )}
        </fieldset>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Start date" htmlFor="startDate" error={err("startDate")}>
          <Input {...describe("startDate", err("startDate"))} type="date" {...form.register("startDate")} />
        </Field>
        <Field label="End date" htmlFor="endDate" error={err("endDate")} hint="Optional.">
          <Input {...describe("endDate", err("endDate"), "hint")} type="date" {...form.register("endDate")} />
        </Field>
        <Field label="Reminder time" htmlFor="reminderTime" error={err("reminderTime")} hint="Saved now; reminders start with notifications in a later phase.">
          <Input {...describe("reminderTime", err("reminderTime"), "hint")} type="time" {...form.register("reminderTime")} />
        </Field>
        <Field label="Category" htmlFor="categoryId" error={err("categoryId")}>
          <OptionSelect {...describe("categoryId", err("categoryId"))} emptyLabel="No category" options={categories.map((c) => ({ value: c.id, label: c.name }))} {...form.register("categoryId")} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Colour</legend>
          <div className="flex flex-wrap gap-2">
            {HABIT_COLORS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={`Colour ${c}`} onClick={() => form.setValue("color", c, { shouldDirty: true })} className={cn("size-9 rounded-full border-2 transition-transform", color === c ? "scale-110 border-foreground" : "border-transparent")} style={{ background: c }} />
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Icon</legend>
          <div className="flex flex-wrap gap-2">
            {HABIT_ICONS.map((i) => (
              <button key={i} type="button" role="radio" aria-checked={icon === i} aria-label={`Icon ${i}`} onClick={() => form.setValue("icon", i, { shouldDirty: true })} className={cn("grid size-9 place-items-center rounded-control border transition-colors", icon === i ? "border-primary bg-primary-soft text-primary" : "border-line text-muted hover:bg-surface-2")}>
                <HabitIcon name={i} className="size-4" />
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <FormFooter
        pending={pending}
        onCancel={onDone}
        submitLabel={habit ? "Save changes" : "Create habit"}
        left={habit && <ConfirmButton onConfirm={remove} loading={deleting} confirmLabel="Delete habit and history?">Delete</ConfirmButton>}
      />
    </form>
  );
}
