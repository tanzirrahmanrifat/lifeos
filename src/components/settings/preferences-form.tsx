"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { Select } from "@/components/ui/input";
import { Field, FormError, describe } from "@/components/forms/field";
import { useServerForm } from "@/hooks/use-server-form";
import { CURRENCIES } from "@/lib/money";
import { cn } from "@/lib/utils";
import { updatePreferencesAction } from "@/modules/settings/actions";
import { DATE_FORMATS, preferencesSchema } from "@/modules/settings/schema";
import { THEME_OPTIONS } from "@/components/layout/theme-toggle";
import { SaveBar } from "./save-bar";

const ICONS = { light: Sun, dark: Moon, system: Monitor };
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface Props {
  settings: { baseCurrency: string; theme: "LIGHT" | "DARK" | "SYSTEM"; dateFormat: string; weekStartsOn: number };
}

export function PreferencesForm({ settings: s }: Props) {
  const { form, submit, pending, formError } = useServerForm({
    schema: preferencesSchema,
    defaultValues: { baseCurrency: s.baseCurrency, theme: s.theme, dateFormat: s.dateFormat as (typeof DATE_FORMATS)[number], weekStartsOn: s.weekStartsOn },
    action: updatePreferencesAction,
    successMessage: "Preferences saved",
  });
  const { errors, isDirty } = form.formState;
  const err = (k: string) => errors[k]?.message as string | undefined;
  const theme = form.watch("theme");

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <FormError message={formError} />

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Appearance</legend>
        <div className="grid grid-cols-3 gap-3">
          {THEME_OPTIONS.map((opt) => {
            const Icon = ICONS[opt.value];
            const selected = theme === opt.db;
            return (
              <label
                key={opt.value}
                className={cn(
                  "flex min-h-20 cursor-pointer flex-col items-center justify-center gap-2 rounded-card border p-3 text-sm transition-colors focus-within:outline-2 focus-within:outline-ring",
                  selected ? "border-primary bg-primary-soft font-medium text-primary" : "border-line hover:bg-surface-2",
                )}
              >
                <input type="radio" value={opt.db} className="sr-only" {...form.register("theme")} />
                <Icon className="size-5" aria-hidden />
                {opt.label}
              </label>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted">Saved with the rest of your preferences; the sun/moon button in the top bar changes it instantly.</p>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Main currency" htmlFor="baseCurrency" error={err("baseCurrency")} hint="Totals and reports are shown in this currency. Existing records keep their own currency.">
          <Select {...describe("baseCurrency", err("baseCurrency"), "hint")} {...form.register("baseCurrency")}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date format" htmlFor="dateFormat" error={err("dateFormat")}>
          <Select {...describe("dateFormat", err("dateFormat"))} {...form.register("dateFormat")}>
            {DATE_FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Week starts on" htmlFor="weekStartsOn" error={err("weekStartsOn")}>
          <Select {...describe("weekStartsOn", err("weekStartsOn"))} {...form.register("weekStartsOn")}>
            {DAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <SaveBar pending={pending} dirty={isDirty} />
    </form>
  );
}
