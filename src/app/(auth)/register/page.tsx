import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/register-form";
import { getCurrentUser } from "@/lib/auth/session";
import { isRegistrationOpen } from "@/modules/auth/service";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/dashboard");

  if (!(await isRegistrationOpen())) {
    return (
      <>
        <h1 className="text-3xl font-semibold tracking-tight">Registration is closed</h1>
        <p className="mt-2 text-muted">This installation already has an owner. Sign in with the existing account.</p>
        <Link href="/login" className="mt-6 inline-block font-medium text-primary hover:underline">
          Go to sign in
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Create your workspace</h1>
      <p className="mb-8 mt-2 text-muted">It takes a minute. You can add clients, accounts and habits after.</p>
      <RegisterForm />
      <p className="mt-8 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
