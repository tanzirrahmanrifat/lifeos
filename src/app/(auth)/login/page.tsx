import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth/session";
import { isRegistrationOpen } from "@/modules/auth/service";
import { safeRedirectPath } from "@/lib/validation";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const { next, reset } = await searchParams;
  if (await getCurrentUser()) redirect(safeRedirectPath(next));
  const canRegister = await isRegistrationOpen();

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mb-8 mt-2 text-muted">Sign in to your dashboard.</p>
      {reset && (
        <p role="status" className="mb-5 rounded-control border border-success/30 bg-success-soft px-3 py-2.5 text-sm text-success">
          Your password has been changed. Sign in with the new one.
        </p>
      )}
      <LoginForm next={next ? safeRedirectPath(next) : undefined} />
      {canRegister && (
        <p className="mt-8 text-center text-sm text-muted">
          New here?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
      )}
    </>
  );
}
