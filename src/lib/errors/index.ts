import { z } from "zod";

export type FieldErrors = Record<string, string[]>;

export type ErrorCode =
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string; fieldErrors?: FieldErrors } };

/** An error whose message is safe to show to the user. Anything else is treated as internal. */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const validationError = (message: string, fieldErrors?: FieldErrors) =>
  new AppError("VALIDATION", message, fieldErrors);
export const unauthorized = (message = "You need to sign in to continue.") => new AppError("UNAUTHORIZED", message);
export const forbidden = (message = "You don't have permission to do that.") => new AppError("FORBIDDEN", message);
export const notFound = (what = "Record") => new AppError("NOT_FOUND", `${what} not found.`);
export const conflict = (message: string, fieldErrors?: FieldErrors) => new AppError("CONFLICT", message, fieldErrors);
export const rateLimited = (retryAfterSec: number) => {
  const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
  return new AppError("RATE_LIMITED", `Too many attempts. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`);
};

export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/**
 * Wraps a server action body: validation/app errors become friendly results, anything else is
 * logged with a reference id and returned as a generic message (no database details leak).
 * Do not call `redirect()` inside `fn` — return data and let the client navigate.
 */
export async function safeAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return {
        ok: false,
        error: { code: "VALIDATION", message: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(err) },
      };
    }
    if (err instanceof AppError) {
      return { ok: false, error: { code: err.code, message: err.message, fieldErrors: err.fieldErrors } };
    }
    const ref = Math.random().toString(36).slice(2, 10);
    console.error(`[action-error ref=${ref}]`, err);
    return { ok: false, error: { code: "INTERNAL", message: `Something went wrong on our side. Reference: ${ref}.` } };
  }
}
