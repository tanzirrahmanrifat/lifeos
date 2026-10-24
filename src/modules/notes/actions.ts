"use server";

import { z } from "zod";
import { runAction } from "@/lib/auth/run-action";
import { noteInputSchema } from "./schema";
import * as service from "./service";

export const saveNoteAction = async (input: unknown) =>
  runAction(async ({ ctx }) => ({ id: await service.saveNote(ctx, noteInputSchema.parse(input)) }));

export const setNotePinnedAction = async (input: unknown) =>
  runAction(async ({ ctx }) => {
    const v = z.object({ id: z.string().min(1), pinned: z.boolean() }).parse(input);
    await service.setNotePinned(ctx, v.id, v.pinned);
  });

export const deleteNoteAction = async (id: unknown) =>
  runAction(async ({ ctx }) => service.deleteNote(ctx, z.string().min(1).parse(id)));
