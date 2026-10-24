"use server";

import { createSession, destroyCurrentSession, getClientIp } from "@/lib/auth/session";
import { safeAction } from "@/lib/errors";
import { safeRedirectPath } from "@/lib/validation";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "./schema";
import { authenticate, registerUser, requestPasswordReset, resetPassword } from "./service";

export async function registerAction(input: unknown) {
  return safeAction(async () => {
    const data = registerSchema.parse(input);
    const userId = await registerUser(data, await getClientIp());
    await createSession(userId);
    return { redirectTo: "/dashboard" };
  });
}

export async function loginAction(input: unknown) {
  return safeAction(async () => {
    const data = loginSchema.parse(input);
    const userId = await authenticate(data.email, data.password, await getClientIp());
    await createSession(userId);
    return { redirectTo: safeRedirectPath(data.next) };
  });
}

export async function logoutAction() {
  return safeAction(async () => {
    await destroyCurrentSession();
    return { redirectTo: "/login" };
  });
}

export async function forgotPasswordAction(input: unknown) {
  return safeAction(async () => {
    const data = forgotPasswordSchema.parse(input);
    await requestPasswordReset(data.email, await getClientIp());
    return { sent: true as const };
  });
}

export async function resetPasswordAction(input: unknown) {
  return safeAction(async () => {
    const data = resetPasswordSchema.parse(input);
    await resetPassword(data.token, data.password, await getClientIp());
    return { redirectTo: "/login?reset=1" };
  });
}
