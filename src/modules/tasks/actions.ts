"use server";

import { z } from "zod";
import { runAction } from "@/lib/auth/run-action";
import { taskInputSchema, TASK_STATUSES } from "./schema";
import * as service from "./service";

export const saveTaskAction = async (input: unknown) =>
  runAction(async ({ ctx }) => ({ id: await service.saveTask(ctx, taskInputSchema.parse(input)) }));

export const setTaskStatusAction = async (input: unknown) =>
  runAction(async ({ ctx }) => {
    const { id, status } = z.object({ id: z.string().min(1), status: z.enum(TASK_STATUSES) }).parse(input);
    await service.setTaskStatus(ctx, id, status);
  });

export const toggleSubtaskAction = async (input: unknown) =>
  runAction(async ({ ctx }) => {
    const { taskId, subtaskId, done } = z.object({ taskId: z.string().min(1), subtaskId: z.string().min(1), done: z.boolean() }).parse(input);
    await service.toggleSubtask(ctx, taskId, subtaskId, done);
  });

export const deleteTaskAction = async (id: unknown) =>
  runAction(async ({ ctx }) => service.deleteTask(ctx, z.string().min(1).parse(id)));
