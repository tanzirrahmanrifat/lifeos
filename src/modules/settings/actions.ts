"use server";

import { revalidatePath } from "next/cache";
import { destroyOtherSessions } from "@/lib/auth/session";
import { requireUser, toCtx } from "@/lib/auth/require-user";
import { safeAction } from "@/lib/errors";
import {
  businessSchema,
  categorySchema,
  categoryUpdateSchema,
  changePasswordSchema,
  invoiceSettingsSchema,
  notificationPrefsSchema,
  preferencesSchema,
  profileSchema,
} from "./schema";
import * as service from "./service";
import { z } from "zod";

/** Every action: authenticate → validate on the server → call the service → revalidate. */
async function run<T>(fn: (ctx: ReturnType<typeof toCtx>) => Promise<T>) {
  return safeAction(async () => {
    const ctx = toCtx(await requireUser());
    const result = await fn(ctx);
    revalidatePath("/", "layout");
    return result;
  });
}

export const updateProfileAction = async (input: unknown) =>
  run((ctx) => service.updateProfile(ctx, profileSchema.parse(input)));

export const changePasswordAction = async (input: unknown) =>
  run(async (ctx) => {
    await service.changePassword(ctx, changePasswordSchema.parse(input));
    await destroyOtherSessions(ctx.userId, true); // sign out every other device
  });

export const updateBusinessAction = async (input: unknown) =>
  run((ctx) => service.updateBusiness(ctx, businessSchema.parse(input)));

export const updatePreferencesAction = async (input: unknown) =>
  run((ctx) => service.updatePreferences(ctx, preferencesSchema.parse(input)));

export const updateThemeAction = async (input: unknown) =>
  run((ctx) => service.updateTheme(ctx, z.enum(["LIGHT", "DARK", "SYSTEM"]).parse(input)));

export const updateInvoiceSettingsAction = async (input: unknown) =>
  run((ctx) => service.updateInvoiceSettings(ctx, invoiceSettingsSchema.parse(input)));

export const updateNotificationPrefsAction = async (input: unknown) =>
  run((ctx) => service.updateNotificationPrefs(ctx, notificationPrefsSchema.parse(input)));

/** Returns the created category so forms can select it straight away (inline "+ New category"). */
export const createCategoryAction = async (input: unknown) =>
  run(async (ctx) => {
    const c = await service.createCategory(ctx, categorySchema.parse(input));
    return { id: c.id, name: c.name, color: c.color };
  });

export const updateCategoryAction = async (input: unknown) =>
  run(async (ctx) => {
    await service.updateCategory(ctx, categoryUpdateSchema.parse(input));
  });

export const archiveCategoryAction = async (id: unknown) =>
  run((ctx) => service.archiveCategory(ctx, z.string().min(1).parse(id)));
