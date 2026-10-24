"use client";
import { MailCheck } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError, describe } from "@/components/forms/field";
import { useServerForm } from "@/hooks/use-server-form";
import { forgotPasswordAction } from "@/modules/auth/actions";
import { forgotPasswordSchema } from "@/modules/auth/schema";

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const { form, submit, pending, formError } = useServerForm({
    schema: forgotPasswordSchema,
    defaultValues: { email: "" },
    action: forgotPasswordAction,
    onSuccess: () => setSentTo(form.getValues("email")),
  });
  const err = form.formState.errors.email?.message as string | undefined;

  if (sentTo) {
    return (
      <div className="rounded-card border border-line bg-surface p-5 text-sm">
        <MailCheck className="mb-3 size-6 text-primary" aria-hidden />
        <p className="font-medium">Check your inbox</p>
        <p className="mt-1 text-muted">
          If an account exists for <span className="font-medium text-foreground">{sentTo}</span>, we&apos;ve sent a link to choose a new password. It expires in 30 minutes.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <FormError message={formError} />
      <Field label="Email" htmlFor="email" error={err}>
        <Input {...describe("email", err)} type="email" autoComplete="email" inputMode="email" autoFocus {...form.register("email")} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Send reset link
      </Button>
    </form>
  );
}
