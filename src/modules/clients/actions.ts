"use server";

import { z } from "zod";
import { runAction } from "@/lib/auth/run-action";
import { getSettingsBundle } from "@/modules/settings/service";
import { clientInputSchema } from "./schema";
import * as service from "./service";

export const saveClientAction = async (input: unknown) =>
  runAction(async ({ ctx }) => ({ id: await service.saveClient(ctx, clientInputSchema.parse(input)) }));

export const deleteClientAction = async (id: unknown) =>
  runAction(async ({ ctx }) => service.deleteClient(ctx, z.string().min(1).parse(id)));

export const getClientAction = async (id: unknown) =>
  runAction(async ({ ctx }) => {
    const { settings } = await getSettingsBundle(ctx);
    return service.getClient(ctx, z.string().min(1).parse(id), settings.baseCurrency);
  });

export const getClientActivityAction = async (id: unknown) =>
  runAction(async ({ ctx }) => service.listClientActivity(ctx, z.string().min(1).parse(id)));
