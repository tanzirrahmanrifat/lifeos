import type { Prisma } from "@/generated/prisma/client";
import type { Ctx } from "@/lib/auth/require-user";
import { forUser } from "@/lib/db/tenant";
import { notFound, validationError } from "@/lib/errors";
import { assertOwnedCategory } from "@/modules/shared/categories";
import { resolveTagIds } from "@/modules/shared/tags";
import type { NoteInput, NoteListQuery } from "./schema";
import type { NoteDTO, NoteListResult } from "./types";

export const NOTE_PAGE_SIZE = 24;

const noteInclude = {
  category: { select: { name: true, color: true } },
  goal: { select: { name: true } },
  tags: { select: { tag: { select: { name: true } } } },
} satisfies Prisma.NoteInclude;
type NoteRow = Prisma.NoteGetPayload<{ include: typeof noteInclude }>;

const excerptOf = (content: string) => {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length > 180 ? `${flat.slice(0, 177)}…` : flat;
};

function toDTO(n: NoteRow): NoteDTO {
  return {
    id: n.id,
    title: n.title,
    content: n.content,
    excerpt: excerptOf(n.content),
    categoryId: n.categoryId,
    categoryName: n.category?.name ?? null,
    categoryColor: n.category?.color ?? null,
    goalId: n.goalId,
    goalName: n.goal?.name ?? null,
    tags: n.tags.map((t) => t.tag.name).sort((a, b) => a.localeCompare(b)),
    pinned: n.pinned,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  };
}

export async function listNotes(ctx: Ctx, query: NoteListQuery): Promise<NoteListResult> {
  const db = forUser(ctx.userId);
  const where: Prisma.NoteWhereInput = {
    AND: [
      { deletedAt: null },
      query.categoryId ? { categoryId: query.categoryId } : {},
      query.tag ? { tags: { some: { tag: { name: { equals: query.tag, mode: "insensitive" } } } } } : {},
      query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: "insensitive" } },
              { content: { contains: query.q, mode: "insensitive" } },
              { tags: { some: { tag: { name: { contains: query.q, mode: "insensitive" } } } } },
            ],
          }
        : {},
    ],
  };
  const [total, rows, tags] = await Promise.all([
    db.note.count({ where }),
    db.note.findMany({
      where,
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      skip: (query.page - 1) * NOTE_PAGE_SIZE,
      take: NOTE_PAGE_SIZE,
      include: noteInclude,
    }),
    db.tag.findMany({ where: { notes: { some: { note: { deletedAt: null } } } }, orderBy: { name: "asc" }, select: { name: true } }),
  ]);
  return { items: rows.map(toDTO), total, page: query.page, pageSize: NOTE_PAGE_SIZE, allTags: tags.map((t) => t.name) };
}

export async function getNote(ctx: Ctx, id: string): Promise<NoteDTO | null> {
  const row = await forUser(ctx.userId).note.findFirst({ where: { id, deletedAt: null }, include: noteInclude });
  return row ? toDTO(row) : null;
}

export async function saveNote(ctx: Ctx, input: NoteInput): Promise<string> {
  const db = forUser(ctx.userId);
  await assertOwnedCategory(db, input.categoryId, "NOTE");
  if (input.goalId) {
    const goal = await db.goal.findFirst({ where: { id: input.goalId, deletedAt: null }, select: { id: true } });
    if (!goal) throw validationError("That goal no longer exists.", { goalId: ["Choose a goal from the list."] });
  }
  const tagIds = await resolveTagIds(db, ctx.userId, input.tags);
  const fields = { title: input.title, content: input.content, categoryId: input.categoryId, goalId: input.goalId, pinned: input.pinned };

  return db.$transaction(async (tx) => {
    let id: string;
    if (input.id) {
      const existing = await tx.note.findFirst({ where: { id: input.id, deletedAt: null }, select: { id: true } });
      if (!existing) throw notFound("Note");
      id = existing.id;
      await tx.note.update({ where: { id }, data: fields });
    } else {
      id = (await tx.note.create({ data: { userId: ctx.userId, ...fields } })).id;
    }
    await tx.noteTag.deleteMany({ where: { noteId: id } });
    if (tagIds.length > 0) await tx.noteTag.createMany({ data: tagIds.map((tagId) => ({ noteId: id, tagId })) });
    return id;
  });
}

export async function setNotePinned(ctx: Ctx, id: string, pinned: boolean): Promise<void> {
  const { count } = await forUser(ctx.userId).note.updateMany({ where: { id, deletedAt: null }, data: { pinned } });
  if (count === 0) throw notFound("Note");
}

export async function deleteNote(ctx: Ctx, id: string): Promise<void> {
  const { count } = await forUser(ctx.userId).note.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
  if (count === 0) throw notFound("Note");
}
