"use server";

import { z } from "zod";
import { runAction } from "@/lib/auth/run-action";
import { zOptionalIsoDate } from "@/lib/validation";
import { GOAL_STATUSES, goalInputSchema } from "./schema";
import * as service from "./service";

export const saveGoalAction = async (input: unknown) =>
  runAction(async ({ ctx }) => ({ id: await service.saveGoal(ctx, goalInputSchema.parse(input)) }));

export const setMilestoneDoneAction = async (input: unknown) =>
  runAction(async ({ ctx }) => {
    const v = z.object({ goalId: z.string().min(1), milestoneId: z.string().min(1), done: z.boolean() }).parse(input);
    await service.setMilestoneDone(ctx, v.goalId, v.milestoneId, v.done);
  });

export const addMilestoneAction = async (input: unknown) =>
  runAction(async ({ ctx }) => {
    const v = z
      .object({ goalId: z.string().min(1), title: z.string().trim().min(1, "Enter a milestone.").max(200), dueDate: zOptionalIsoDate })
      .parse(input);
    await service.addMilestone(ctx, v.goalId, v.title, v.dueDate);
  });

export const deleteMilestoneAction = async (input: unknown) =>
  runAction(async ({ ctx }) => {
    const v = z.object({ goalId: z.string().min(1), milestoneId: z.string().min(1) }).parse(input);
    await service.deleteMilestone(ctx, v.goalId, v.milestoneId);
  });

export const setGoalStatusAction = async (input: unknown) =>
  runAction(async ({ ctx }) => {
    const v = z.object({ id: z.string().min(1), status: z.enum(GOAL_STATUSES) }).parse(input);
    await service.setGoalStatus(ctx, v.id, v.status);
  });

export const deleteGoalAction = async (id: unknown) =>
  runAction(async ({ ctx }) => service.deleteGoal(ctx, z.string().min(1).parse(id)));
