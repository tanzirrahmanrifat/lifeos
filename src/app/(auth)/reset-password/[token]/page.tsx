import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mb-8 mt-2 text-muted">You&apos;ll be signed out on every device once it&apos;s changed.</p>
      <ResetPasswordForm token={token} />
    </>
  );
}
