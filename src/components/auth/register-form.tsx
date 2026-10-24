"use client";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field, FormError, PasswordInput, describe } from "@/components/forms/field";
import { useServerForm } from "@/hooks/use-server-form";
import { CURRENCIES } from "@/lib/money";
import { registerAction } from "@/modules/auth/actions";
import { registerSchema } from "@/modules/auth/schema";

export function RegisterForm() {
  const router = useRouter();
  const { form, submit, pending, formError } = useServerForm({
    schema: registerSchema,
    defaultValues: { name: "", email: "", password: "", confirmPassword: "", baseCurrency: "USD", timezone: "UTC" },
    action: registerAction,
    onSuccess: ({ redirectTo }) => {
      router.replace(redirectTo);
      router.refresh();
    },
  });
  const { errors } = form.formState;
  const err = (k: string) => errors[k]?.message as string | undefined;

  // Detect the browser's time zone once, so "today" on the dashboard is correct from day one.
  React.useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) form.setValue("timezone", tz);
  }, [form]);

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <FormError message={formError} />
      <Field label="Your name" htmlFor="name" error={err("name")}>
        <Input {...describe("name", err("name"))} autoComplete="name" autoFocus {...form.register("name")} />
      </Field>
      <Field label="Email" htmlFor="email" error={err("email")}>
        <Input {...describe("email", err("email"))} type="email" autoComplete="email" inputMode="email" {...form.register("email")} />
      </Field>
      <Field label="Main currency" htmlFor="baseCurrency" error={err("baseCurrency")} hint="Used for totals and reports. You can change it later in Settings.">
        <Select {...describe("baseCurrency", err("baseCurrency"))} {...form.register("baseCurrency")}>
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} — {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Password" htmlFor="password" error={err("password")} hint="At least 10 characters.">
        <PasswordInput {...describe("password", err("password"), "hint")} autoComplete="new-password" {...form.register("password")} />
      </Field>
      <Field label="Confirm password" htmlFor="confirmPassword" error={err("confirmPassword")}>
        <PasswordInput {...describe("confirmPassword", err("confirmPassword"))} autoComplete="new-password" {...form.register("confirmPassword")} />
      </Field>
      <input type="hidden" {...form.register("timezone")} />
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Create account
      </Button>
    </form>
  );
}
