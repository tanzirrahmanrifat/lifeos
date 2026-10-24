import { z } from "zod";
import { NOTIFICATION_PREFS } from "./notification-prefs";
import {
  zCurrency,
  zEmail,
  zName,
  zOptionalEmail,
  zOptionalPhone,
  zOptionalText,
  zOptionalUrl,
  zPassword,
  zPercentToBps,
  zTimezone,
} from "@/lib/validation";

export const DATE_FORMATS = ["dd MMM yyyy", "MMM d, yyyy", "yyyy-MM-dd", "dd/MM/yyyy", "MM/dd/yyyy"] as const;

export const profileSchema = z.object({
  name: zName,
  email: zEmail,
  phone: zOptionalPhone,
  timezone: zTimezone,
  /** Required only when the email address changes. */
  currentPassword: z.string().max(128).optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password.").max(128),
    newPassword: zPassword,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match." })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ["newPassword"], message: "Choose a different password." });

export const businessSchema = z.object({
  name: zOptionalText(120),
  address: zOptionalText(500),
  email: zOptionalEmail,
  phone: zOptionalPhone,
  website: zOptionalUrl,
  taxId: zOptionalText(60),
});

export const preferencesSchema = z.object({
  baseCurrency: zCurrency,
  theme: z.enum(["LIGHT", "DARK", "SYSTEM"]),
  dateFormat: z.enum(DATE_FORMATS),
  weekStartsOn: z.coerce.number().int().min(0).max(6),
});

export const invoiceSettingsSchema = z.object({
  invoicePrefix: z
    .string()
    .trim()
    .min(1, "Enter a prefix, e.g. INV.")
    .max(10, "Use 10 characters or fewer.")
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers and hyphens only."),
  invoiceNextNumber: z.coerce.number().int("Enter a whole number.").min(1, "Start at 1 or higher.").max(999_999_999),
  invoiceNumberPadding: z.coerce.number().int().min(1).max(8),
  invoiceIncludeYear: z.boolean(),
  invoiceResetYearly: z.boolean(),
  defaultPaymentTermsDays: z.coerce.number().int("Enter a whole number of days.").min(0).max(365),
  /** Entered as a percentage ("18.5"); the parsed output is stored as basis points. */
  defaultTaxPercent: zPercentToBps,
  defaultInvoiceNotes: zOptionalText(1000),
});

export const notificationPrefsSchema = z.object(
  Object.fromEntries(NOTIFICATION_PREFS.map(({ key }) => [key, z.boolean()])) as Record<
    (typeof NOTIFICATION_PREFS)[number]["key"],
    z.ZodBoolean
  >,
);

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #0e6b5c.");

export const categorySchema = z.object({
  type: z.enum(["INCOME", "EXPENSE", "TASK", "GOAL", "NOTE", "HABIT", "DONATION"]),
  name: z.string().trim().min(1, "Enter a name.").max(40, "Use 40 characters or fewer."),
  color: hexColor.optional(),
});

export const categoryUpdateSchema = z.object({
  id: z.string().min(1),
  name: categorySchema.shape.name,
  color: hexColor.optional(),
});
