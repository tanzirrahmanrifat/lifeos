import { z } from "zod";
import { CURRENCY_CODES } from "@/lib/money";
import { isValidIsoDate } from "@/lib/dates";
import { parseDecimal } from "@/lib/money/decimal";

/** Shared field validators so every form and action says the same thing about the same field. */

export const zEmail = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter your email address.")
  .max(254, "That email address is too long.")
  .pipe(z.email("Enter a valid email address."));

export const zPassword = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128, "Use 128 characters or fewer.");

export const zName = z.string().trim().min(1, "Enter a name.").max(80, "Use 80 characters or fewer.");

export const zCurrency = z.enum(CURRENCY_CODES, { error: "Choose a currency from the list." });

export const zTimezone = z
  .string()
  .trim()
  .min(1)
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Choose a valid time zone.");

/** Trimmed optional text: empty string → null. */
export const zOptionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use ${max} characters or fewer.`)
    .transform((v) => (v === "" ? null : v));

export const zOptionalUrl = z
  .string()
  .trim()
  .max(300, "Use 300 characters or fewer.")
  .refine((v) => v === "" || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(v), "Enter a full web address starting with http:// or https://")
  .transform((v) => (v === "" ? null : v));

export const zOptionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email address.")
  .transform((v) => (v === "" ? null : v));

export const zOptionalPhone = z
  .string()
  .trim()
  .max(30, "Use 30 characters or fewer.")
  .refine((v) => v === "" || /^[+\d][\d\s().-]{5,}$/.test(v), "Enter a valid phone number.")
  .transform((v) => (v === "" ? null : v));

/** "18.5" (percent) → 1850 basis points. Two decimal places max, 0–100%. */
export const zPercentToBps = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return 0;
    try {
      const { value, scale } = parseDecimal(v);
      if (scale > 2) throw new RangeError();
      const bps = Number(value) * 10 ** (2 - scale);
      if (bps < 0 || bps > 10000) throw new RangeError();
      return bps;
    } catch {
      ctx.addIssue({ code: "custom", message: "Enter a percentage between 0 and 100 (up to 2 decimals)." });
      return z.NEVER;
    }
  });

/** Only same-site relative paths may be used as post-login redirects (blocks open redirects). */
export function safeRedirectPath(input: string | null | undefined, fallback = "/dashboard"): string {
  if (!input || !input.startsWith("/") || input.startsWith("//") || input.includes("\\")) return fallback;
  return input;
}

/** A required calendar day as "yyyy-mm-dd". */
export const zIsoDate = z.string().trim().refine(isValidIsoDate, "Enter a valid date.");

/** An optional calendar day: empty string → null. */
export const zOptionalIsoDate = z
  .string()
  .trim()
  .refine((v) => v === "" || isValidIsoDate(v), "Enter a valid date.")
  .transform((v) => (v === "" ? null : v));

/** An optional reference to another record; empty string → null. Ownership is checked in the service. */
export const zOptionalId = z
  .string()
  .trim()
  .max(60)
  .transform((v) => (v === "" ? null : v));

/** "design, urgent , Design" → ["design", "urgent"] (max 10, case-insensitively unique). */
export const zTagList = z
  .string()
  .max(500, "Too many tags.")
  .transform((raw, ctx) => {
    const seen = new Set<string>();
    const tags: string[] = [];
    for (const part of raw.split(",")) {
      const name = part.trim().replace(/\s+/g, " ");
      if (!name) continue;
      if (name.length > 30) {
        ctx.addIssue({ code: "custom", message: "Each tag can be up to 30 characters." });
        return z.NEVER;
      }
      if (seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      tags.push(name);
    }
    if (tags.length > 10) {
      ctx.addIssue({ code: "custom", message: "Use 10 tags or fewer." });
      return z.NEVER;
    }
    return tags;
  });

export const zHexColor = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour.");

export const zClockTime = z
  .string()
  .trim()
  .refine((v) => v === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), "Use a time like 09:30.")
  .transform((v) => (v === "" ? null : v));
