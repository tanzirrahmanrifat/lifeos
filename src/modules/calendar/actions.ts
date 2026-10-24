"use server";

import { z } from "zod";
import { runAction } from "@/lib/auth/run-action";
import { eventInputSchema } from "./schema";
import * as service from "./service";

export const getEventAction = async (id: unknown) =>
  runAction(async ({ ctx, timeZone }) => service.getEvent(ctx, z.string().min(1).parse(id), timeZone));


export const saveEventAction = async (input: unknown) =>
  runAction(async ({ ctx, timeZone }) => ({ id: await service.saveEvent(ctx, eventInputSchema.parse(input), timeZone) }));

export const deleteEventAction = async (id: unknown) =>
  runAction(async ({ ctx }) => service.deleteEvent(ctx, z.string().min(1).parse(id)));
