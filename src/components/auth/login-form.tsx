"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError, PasswordInput, describe } from "@/components/forms/field";
import { useServerForm } from "@/hooks/use-server-form";
import { loginAction } from "@/modules/auth/actions";
import { loginSchema } from "@/modules/auth/schema";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const { form, submit, pending, formError } = useServerForm({
    schema: loginSchema,
    defaultValues: { email: "", password: "", next },
    action: loginAction,
    onSuccess: ({ redirectTo }) => {
      router.replace(redirectTo);
      router.refresh();
    },
  });
  const { errors } = form.formState;

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <FormError message={formError} />
      <Field label="Email" htmlFor="email" error={errors.email?.message as string | undefined}>
        <Input {...describe("email", errors.email?.message as string | undefined)} type="email" autoComplete="email" inputMode="email" autoFocus {...form.register("email")} />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        error={errors.password?.message as string | undefined}
        aside={
          <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        }
      >
        <PasswordInput {...describe("password", errors.password?.message as string | undefined)} autoComplete="current-password" {...form.register("password")} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Sign in
      </Button>
    </form>
  );
}
