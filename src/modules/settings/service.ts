import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { forUser } from "@/lib/db/tenant";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import type { Ctx } from "@/lib/auth/require-user";
import { AppError, conflict, notFound, validationError } from "@/lib/errors";
import { DEFAULT_CATEGORIES } from "./default-categories";
import { resolveNotificationPrefs, type NotificationPrefs } from "./notification-prefs";
import type {
  businessSchema,
  categorySchema,
  categoryUpdateSchema,
  changePasswordSchema,
  invoiceSettingsSchema,
  notificationPrefsSchema,
  preferencesSchema,
  profileSchema,
} from "./schema";

type In<T extends z.ZodType> = z.output<T>;

export interface SettingsBundle {
  user: { id: string; name: string; email: string; phone: string | null; avatarUrl: string | null; timezone: string };
  settings: {
    baseCurrency: string;
    theme: "LIGHT" | "DARK" | "SYSTEM";
    dateFormat: string;
    weekStartsOn: number;
    invoicePrefix: string;
    invoiceNextNumber: number;
    invoiceNumberPadding: number;
    invoiceIncludeYear: boolean;
    invoiceResetYearly: boolean;
    defaultPaymentTermsDays: number;
    defaultTaxBps: number;
    defaultInvoiceNotes: string | null;
    notificationPrefs: NotificationPrefs;
  };
  business: { name: string | null; logoUrl: string | null; address: string | null; email: string | null; phone: string | null; website: string | null; taxId: string | null };
}

export async function getSettingsBundle(ctx: Ctx): Promise<SettingsBundle> {
  const db = forUser(ctx.userId);
  const [user, settings, business] = await Promise.all([
    prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { id: true, name: true, email: true, phone: true, avatarUrl: true, timezone: true },
    }),
    db.userSettings.findUnique({ where: { userId: ctx.userId } }),
    db.businessProfile.findUnique({ where: { userId: ctx.userId } }),
  ]);
  if (!user || !settings) throw notFound("Account");

  return {
    user,
    settings: { ...settings, notificationPrefs: resolveNotificationPrefs(settings.notificationPrefs) },
    business: {
      name: business?.name ?? null,
      logoUrl: business?.logoUrl ?? null,
      address: business?.address ?? null,
      email: business?.email ?? null,
      phone: business?.phone ?? null,
      website: business?.website ?? null,
      taxId: business?.taxId ?? null,
    },
  };
}

export async function updateProfile(ctx: Ctx, input: In<typeof profileSchema>): Promise<void> {
  const current = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { email: true, passwordHash: true } });
  if (!current) throw notFound("Account");

  const emailChanged = input.email !== current.email;
  if (emailChanged) {
    // Changing the sign-in identifier requires proof of the current password.
    if (!input.currentPassword || !(await verifyPassword(current.passwordHash, input.currentPassword))) {
      throw validationError("Enter your current password to change your email.", {
        currentPassword: ["Enter your current password to change your email."],
      });
    }
  }

  try {
    await prisma.user.update({
      where: { id: ctx.userId },
      data: {
        name: input.name,
        phone: input.phone,
        timezone: input.timezone,
        ...(emailChanged ? { email: input.email, emailVerifiedAt: null } : {}),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw conflict("That email is already in use.", { email: ["That email is already in use."] });
    }
    throw err;
  }
}

export async function changePassword(ctx: Ctx, input: In<typeof changePasswordSchema>): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { passwordHash: true } });
  if (!user) throw notFound("Account");
  if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
    throw validationError("Your current password is incorrect.", { currentPassword: ["Your current password is incorrect."] });
  }
  await prisma.user.update({ where: { id: ctx.userId }, data: { passwordHash: await hashPassword(input.newPassword) } });
}

export async function updateBusiness(ctx: Ctx, input: In<typeof businessSchema>): Promise<void> {
  const db = forUser(ctx.userId);
  await db.businessProfile.upsert({ where: { userId: ctx.userId }, create: { userId: ctx.userId, ...input }, update: { ...input } });
}

export async function updatePreferences(ctx: Ctx, input: In<typeof preferencesSchema>): Promise<void> {
  await forUser(ctx.userId).userSettings.update({ where: { userId: ctx.userId }, data: input });
}

export async function updateTheme(ctx: Ctx, theme: "LIGHT" | "DARK" | "SYSTEM"): Promise<void> {
  await forUser(ctx.userId).userSettings.update({ where: { userId: ctx.userId }, data: { theme } });
}

export async function updateInvoiceSettings(ctx: Ctx, input: In<typeof invoiceSettingsSchema>): Promise<void> {
  const { defaultTaxPercent, ...rest } = input;
  await forUser(ctx.userId).userSettings.update({
    where: { userId: ctx.userId },
    data: { ...rest, defaultTaxBps: defaultTaxPercent },
  });
}

export async function updateNotificationPrefs(ctx: Ctx, input: In<typeof notificationPrefsSchema>): Promise<void> {
  await forUser(ctx.userId).userSettings.update({ where: { userId: ctx.userId }, data: { notificationPrefs: input } });
}

// ───────────────────────── Categories ─────────────────────────

export async function listCategories(ctx: Ctx) {
  return forUser(ctx.userId).category.findMany({
    where: { deletedAt: null },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: { id: true, type: true, name: true, color: true, isSystem: true },
  });
}

export async function createCategory(ctx: Ctx, input: In<typeof categorySchema>) {
  const db = forUser(ctx.userId);
  const existing = await db.category.findFirst({ where: { type: input.type, name: input.name } });
  if (existing) {
    if (!existing.deletedAt) {
      throw conflict("You already have a category with that name.", { name: ["You already have a category with that name."] });
    }
    // Bring back a previously archived category rather than colliding with its unique name.
    return db.category.update({ where: { id: existing.id }, data: { deletedAt: null, color: input.color ?? existing.color } });
  }
  return db.category.create({ data: { userId: ctx.userId, type: input.type, name: input.name, color: input.color ?? null } });
}

export async function updateCategory(ctx: Ctx, input: In<typeof categoryUpdateSchema>) {
  const db = forUser(ctx.userId);
  const category = await db.category.findFirst({ where: { id: input.id, deletedAt: null } });
  if (!category) throw notFound("Category");
  if (category.isSystem && category.name !== input.name) {
    throw new AppError("FORBIDDEN", `"${category.name}" is used by the system and can't be renamed. You can still change its colour.`);
  }
  const clash = await db.category.findFirst({ where: { type: category.type, name: input.name, NOT: { id: category.id } } });
  if (clash) throw conflict("You already have a category with that name.", { name: ["You already have a category with that name."] });
  return db.category.update({ where: { id: category.id }, data: { name: input.name, color: input.color ?? category.color } });
}

/** Archives instead of deleting so historical transactions keep their category. */
export async function archiveCategory(ctx: Ctx, id: string): Promise<void> {
  const db = forUser(ctx.userId);
  const category = await db.category.findFirst({ where: { id, deletedAt: null } });
  if (!category) throw notFound("Category");
  if (category.isSystem) throw new AppError("FORBIDDEN", `"${category.name}" is used by the system and can't be removed.`);
  await db.category.update({ where: { id }, data: { deletedAt: new Date() } });
}

/**
 * Categories of one kind. Categories added in later phases (habits arrived in Phase 2) are created
 * on first use, so accounts made earlier get the same starter set as new ones.
 */
export async function listCategoriesOfType(ctx: Ctx, type: "INCOME" | "EXPENSE" | "TASK" | "GOAL" | "NOTE" | "HABIT" | "DONATION") {
  const db = forUser(ctx.userId);
  const select = { id: true, name: true, color: true } as const;
  const list = () => db.category.findMany({ where: { type, deletedAt: null }, orderBy: { name: "asc" }, select });
  const found = await list();
  if (found.length > 0) return found;
  if ((await db.category.count({ where: { type } })) > 0) return found; // all archived on purpose
  const defaults = DEFAULT_CATEGORIES.filter((c) => c.type === type);
  if (defaults.length === 0) return found;
  await db.category.createMany({ data: defaults.map((c) => ({ ...c, userId: ctx.userId })), skipDuplicates: true });
  return list();
}
