"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, FormError, PasswordInput, describe } from "@/components/forms/field";
import { useServerForm } from "@/hooks/use-server-form";
import { resetPasswordAction } from "@/modules/auth/actions";
import { resetPasswordSchema } from "@/modules/auth/schema";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const { form, submit, pending, formError } = useServerForm({
    schema: resetPasswordSchema,
    defaultValues: { token, password: "", confirmPassword: "" },
    action: resetPasswordAction,
    onSuccess: ({ redirectTo }) => router.replace(redirectTo),
  });
  const { errors } = form.formState;
  const err = (k: string) => errors[k]?.message as string | undefined;

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <FormError message={formError ?? err("token")} />
      <Field label="New password" htmlFor="password" error={err("password")} hint="At least 10 characters.">
        <PasswordInput {...describe("password", err("password"), "hint")} autoComplete="new-password" autoFocus {...form.register("password")} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirmPassword" error={err("confirmPassword")}>
        <PasswordInput {...describe("confirmPassword", err("confirmPassword"))} autoComplete="new-password" {...form.register("confirmPassword")} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Set new password
      </Button>
    </form>
  );
}
