"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError, PasswordInput, describe } from "@/components/forms/field";
import { useServerForm } from "@/hooks/use-server-form";
import { changePasswordAction, updateProfileAction } from "@/modules/settings/actions";
import { changePasswordSchema, profileSchema } from "@/modules/settings/schema";
import { SaveBar } from "./save-bar";

interface Props {
  user: { name: string; email: string; phone: string | null; timezone: string };
}

export function ProfileForm({ user }: Props) {
  const { form, submit, pending, formError } = useServerForm({
    schema: profileSchema,
    defaultValues: { name: user.name, email: user.email, phone: user.phone ?? "", timezone: user.timezone, currentPassword: "" },
    action: updateProfileAction,
    successMessage: "Profile saved",
  });
  const { errors, isDirty } = form.formState;
  const err = (k: string) => errors[k]?.message as string | undefined;
  const emailChanged = form.watch("email")?.trim().toLowerCase() !== user.email;

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <FormError message={formError} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" error={err("name")}>
          <Input {...describe("name", err("name"))} autoComplete="name" {...form.register("name")} />
        </Field>
        <Field label="Phone" htmlFor="phone" error={err("phone")}>
          <Input {...describe("phone", err("phone"))} type="tel" autoComplete="tel" {...form.register("phone")} />
        </Field>
        <Field label="Email" htmlFor="email" error={err("email")} className="sm:col-span-2">
          <Input {...describe("email", err("email"))} type="email" autoComplete="email" {...form.register("email")} />
        </Field>
        {emailChanged && (
          <Field label="Current password" htmlFor="currentPassword" error={err("currentPassword")} hint="Needed to change your email address." className="sm:col-span-2">
            <PasswordInput {...describe("currentPassword", err("currentPassword"), "hint")} autoComplete="current-password" {...form.register("currentPassword")} />
          </Field>
        )}
        <Field label="Time zone" htmlFor="timezone" error={err("timezone")} hint="Decides what counts as “today” for tasks, habits and the dashboard." className="sm:col-span-2">
          <Input {...describe("timezone", err("timezone"), "hint")} list="tz-list" {...form.register("timezone")} />
          <datalist id="tz-list">
            {(typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : []).map((tz) => (
              <option key={tz} value={tz} />
            ))}
          </datalist>
        </Field>
      </div>
      <p className="rounded-control bg-surface-2 px-3 py-2.5 text-sm text-muted">
        Profile pictures need file storage, which arrives with the upload features in a later phase.
      </p>
      <SaveBar pending={pending} dirty={isDirty} />
    </form>
  );
}

export function PasswordForm() {
  const { form, submit, pending, formError } = useServerForm({
    schema: changePasswordSchema,
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
    action: changePasswordAction,
    successMessage: "Password changed. Other devices were signed out.",
    resetOnSuccess: true,
  });
  const { errors } = form.formState;
  const err = (k: string) => errors[k]?.message as string | undefined;

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <FormError message={formError} />
      <Field label="Current password" htmlFor="currentPassword" error={err("currentPassword")}>
        <PasswordInput {...describe("currentPassword", err("currentPassword"))} autoComplete="current-password" {...form.register("currentPassword")} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="New password" htmlFor="newPassword" error={err("newPassword")} hint="At least 10 characters.">
          <PasswordInput {...describe("newPassword", err("newPassword"), "hint")} autoComplete="new-password" {...form.register("newPassword")} />
        </Field>
        <Field label="Confirm new password" htmlFor="confirmPassword" error={err("confirmPassword")}>
          <PasswordInput {...describe("confirmPassword", err("confirmPassword"))} autoComplete="new-password" {...form.register("confirmPassword")} />
        </Field>
      </div>
      <div className="flex justify-end border-t border-line pt-5">
        <Button type="submit" loading={pending}>
          Change password
        </Button>
      </div>
    </form>
  );
}
