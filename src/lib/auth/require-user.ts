import "server-only";
import { redirect } from "next/navigation";
import { unauthorized } from "@/lib/errors";
import { getCurrentUser, type AuthUser } from "./session";

/** For pages/layouts: redirects to /login when signed out. */
export async function requireUserOrRedirect(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** For server actions / route handlers: throws an UNAUTHORIZED AppError. */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}

/** Service context. Every service function takes one, and every query is scoped by `userId`. */
export interface Ctx {
  userId: string;
}

export const toCtx = (user: AuthUser): Ctx => ({ userId: user.id });
