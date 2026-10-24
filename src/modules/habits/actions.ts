"use server";

import { z } from "zod";
import { runAction } from "@/lib/auth/run-action";
import { habitInputSchema, habitLogSchema } from "./schema";
import * as service from "./service";

export const saveHabitAction = async (input: unknown) =>
  runAction(async ({ ctx }) => ({ id: await service.saveHabit(ctx, habitInputSchema.parse(input)) }));

export const toggleHabitAction = async (input: unknown) =>
  runAction(async ({ ctx, ...clock }) => {
    const { habitId, date } = habitLogSchema.parse(input);
    return service.toggleHabitLog(ctx, habitId, date, clock);
  });

export const archiveHabitAction = async (input: unknown) =>
  runAction(async ({ ctx }) => {
    const { id, archived } = z.object({ id: z.string().min(1), archived: z.boolean() }).parse(input);
    await service.setHabitArchived(ctx, id, archived);
  });

export const deleteHabitAction = async (id: unknown) =>
  runAction(async ({ ctx }) => service.deleteHabit(ctx, z.string().min(1).parse(id)));
