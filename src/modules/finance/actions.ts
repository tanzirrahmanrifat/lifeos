"use server";

import { z } from "zod";
import { runAction } from "@/lib/auth/run-action";
import { getSettingsBundle } from "@/modules/settings/service";
import { accountInputSchema, budgetInputSchema, transactionInputSchema, transferInputSchema } from "./schema";
import * as service from "./service";

export const saveAccountAction = async (input: unknown) =>
  runAction(async ({ ctx }) => ({ id: await service.saveAccount(ctx, accountInputSchema.parse(input)) }));

export const archiveAccountAction = async (input: unknown) =>
  runAction(async ({ ctx }) => {
    const v = z.object({ id: z.string().min(1), archived: z.boolean() }).parse(input);
    await service.archiveAccount(ctx, v.id, v.archived);
  });

export const deleteAccountAction = async (id: unknown) =>
  runAction(async ({ ctx }) => service.deleteAccount(ctx, z.string().min(1).parse(id)));

export const saveTransactionAction = async (input: unknown) =>
  runAction(async ({ ctx }) => ({ id: await service.saveTransaction(ctx, transactionInputSchema.parse(input)) }));

export const deleteTransactionAction = async (id: unknown) =>
  runAction(async ({ ctx }) => service.deleteTransaction(ctx, z.string().min(1).parse(id)));

export const saveTransferAction = async (input: unknown) =>
  runAction(async ({ ctx }) => ({ id: await service.saveTransfer(ctx, transferInputSchema.parse(input)) }));

export const deleteTransferAction = async (id: unknown) =>
  runAction(async ({ ctx }) => service.deleteTransfer(ctx, z.string().min(1).parse(id)));

export const saveBudgetAction = async (input: unknown) =>
  runAction(async ({ ctx }) => {
    const { settings } = await getSettingsBundle(ctx);
    await service.saveBudget(ctx, budgetInputSchema.parse(input), settings.baseCurrency);
  });
