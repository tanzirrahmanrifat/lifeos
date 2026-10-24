"use server";

import { z } from "zod";
import { runAction } from "@/lib/auth/run-action";
import { projectInputSchema } from "./schema";
import * as service from "./service";

export const saveProjectAction = async (input: unknown) =>
  runAction(async ({ ctx }) => ({ id: await service.saveProject(ctx, projectInputSchema.parse(input)) }));

export const deleteProjectAction = async (id: unknown) =>
  runAction(async ({ ctx }) => service.deleteProject(ctx, z.string().min(1).parse(id)));
