import { z } from "zod";
import { zOptionalId, zTagList } from "@/lib/validation";

export const noteInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Give the note a title.").max(200, "Use 200 characters or fewer."),
  content: z.string().max(50_000, "That's too long for one note — split it up."),
  categoryId: zOptionalId,
  goalId: zOptionalId,
  tags: zTagList,
  pinned: z.boolean(),
});
export type NoteInput = z.output<typeof noteInputSchema>;
export type NoteFormValues = z.input<typeof noteInputSchema>;

export const noteListQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  categoryId: z.string().max(60).optional().catch(undefined),
  tag: z.string().trim().max(30).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type NoteListQuery = z.output<typeof noteListQuerySchema>;
