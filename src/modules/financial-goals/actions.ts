"use server";

import { z } from "zod";
import { runAction } from "@/lib/auth/run-action";
import { getSettingsBundle } from "@/modules/settings/service";
import { contributionInputSchema, financialGoalInputSchema } from "./schema";
import * as service from "./service";

export const saveFinancialGoalAction = async (input: unknown) =>
  runAction(async ({ ctx }) => {
    const { settings } = await getSettingsBundle(ctx);
    return { id: await service.saveFinancialGoal(ctx, financialGoalInputSchema.parse(input), settings.baseCurrency) };
  });

export const deleteFinancialGoalAction = async (id: unknown) =>
  runAction(async ({ ctx }) => service.deleteFinancialGoal(ctx, z.string().min(1).parse(id)));

export const addContributionAction = async (input: unknown) =>
  runAction(async ({ ctx }) => service.addContribution(ctx, contributionInputSchema.parse(input)));

export const deleteContributionAction = async (input: unknown) =>
  runAction(async ({ ctx }) => {
    const v = z.object({ goalId: z.string().min(1), contributionId: z.string().min(1) }).parse(input);
    await service.deleteContribution(ctx, v.goalId, v.contributionId);
  });
