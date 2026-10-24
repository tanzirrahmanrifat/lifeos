import type { ScopedDb } from "@/lib/db/tenant";

/** Finds or creates the user's tags by name (case-insensitive) and returns their ids. */
export async function resolveTagIds(db: ScopedDb, userId: string, names: string[]): Promise<string[]> {
  if (names.length === 0) return [];
  const existing = await db.tag.findMany({ where: { name: { in: names, mode: "insensitive" } } });
  const byLower = new Map(existing.map((t) => [t.name.toLowerCase(), t.id]));
  const ids: string[] = [];
  for (const name of names) {
    let id = byLower.get(name.toLowerCase());
    if (!id) {
      const created = await db.tag.create({ data: { userId, name } });
      id = created.id;
      byLower.set(name.toLowerCase(), id);
    }
    ids.push(id);
  }
  return ids;
}
