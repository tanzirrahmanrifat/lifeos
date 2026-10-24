import { addMinutes } from "date-fns";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "@/lib/auth/password";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { sendEmail, passwordResetEmail } from "@/lib/email";
import { getEnv } from "@/lib/env";
import { AppError, conflict, forbidden } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { DEFAULT_CATEGORIES } from "@/modules/settings/default-categories";
import type { RegisterInput } from "./schema";

const HOUR = 3600;
const LOGIN_WINDOW = 15 * 60;
const RESET_TOKEN_MINUTES = 30;

/** Creates the account plus everything a fresh workspace needs, atomically. Returns the new user id. */
export async function registerUser(input: RegisterInput, ip: string): Promise<string> {
  await enforceRateLimit(`register:ip:${ip}`, 10, HOUR);

  const mode = getEnv().REGISTRATION_MODE;
  if (mode === "closed") throw forbidden("Registration is turned off for this installation.");
  if (mode === "first-user-only" && (await prisma.user.count()) > 0) {
    throw forbidden("This installation already has an owner. Sign in instead, or ask the owner to enable registration.");
  }

  const passwordHash = await hashPassword(input.password);
  try {
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        timezone: input.timezone,
        settings: { create: { baseCurrency: input.baseCurrency } },
        business: { create: {} },
        categories: { createMany: { data: DEFAULT_CATEGORIES } },
      },
      select: { id: true },
    });
    return user.id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw conflict("An account with this email already exists.", { email: ["An account with this email already exists."] });
    }
    throw err;
  }
}

const BAD_LOGIN = () => new AppError("UNAUTHORIZED", "Incorrect email or password.");

/** Verifies credentials. Identical error and similar timing for unknown email vs wrong password. */
export async function authenticate(email: string, password: string, ip: string): Promise<string> {
  await enforceRateLimit(`login:ip:${ip}`, 20, LOGIN_WINDOW);
  await enforceRateLimit(`login:email:${email}`, 8, LOGIN_WINDOW);

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, passwordHash: true } });
  if (!user) {
    await verifyAgainstDummy(password);
    throw BAD_LOGIN();
  }
  if (!(await verifyPassword(user.passwordHash, password))) throw BAD_LOGIN();

  // Opportunistic cleanup of this user's expired sessions.
  await prisma.session.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } });
  return user.id;
}

/** Always resolves the same way whether or not the address exists (no account enumeration). */
export async function requestPasswordReset(email: string, ip: string): Promise<void> {
  await enforceRateLimit(`forgot:ip:${ip}`, 5, HOUR);
  await enforceRateLimit(`forgot:email:${email}`, 3, HOUR);

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true } });
  if (!user) return;

  const token = generateToken();
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt: addMinutes(new Date(), RESET_TOKEN_MINUTES) },
    }),
  ]);

  const url = `${getEnv().APP_URL.replace(/\/$/, "")}/reset-password/${token}`;
  await sendEmail({ to: email, ...passwordResetEmail(user.name, url) });
}

/** Consumes a reset token (single use), sets the new password and signs out every session. */
export async function resetPassword(token: string, newPassword: string, ip: string): Promise<void> {
  await enforceRateLimit(`reset:ip:${ip}`, 10, HOUR);

  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    throw new AppError("VALIDATION", "This reset link is invalid or has expired. Request a new one.");
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    // The `usedAt: null` guard makes the token single-use even under concurrent requests.
    prisma.passwordResetToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);
}

/** Whether the register page should be offered on this installation. */
export async function isRegistrationOpen(): Promise<boolean> {
  const mode = getEnv().REGISTRATION_MODE;
  if (mode === "open") return true;
  if (mode === "closed") return false;
  return (await prisma.user.count()) === 0;
}
