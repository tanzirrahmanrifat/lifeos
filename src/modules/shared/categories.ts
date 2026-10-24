import type { CategoryType } from "@/generated/prisma/enums";
import type { ScopedDb } from "@/lib/db/tenant";
import { validationError } from "@/lib/errors";

/**
 * A record may only point at a category of the right kind that belongs to the same user.
 * Foreign keys sent by the browser are never trusted — this is the ownership check the
 * tenant-scoped client can't do on its own.
 */
export async function assertOwnedCategory(db: ScopedDb, id: string | null, type: CategoryType, field = "categoryId"): Promise<void> {
  if (!id) return;
  const found = await db.category.findFirst({ where: { id, type, deletedAt: null }, select: { id: true } });
  if (!found) throw validationError("That category no longer exists.", { [field]: ["Choose a category from the list."] });
}
