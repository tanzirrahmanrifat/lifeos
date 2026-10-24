"use server";

import { z } from "zod";
import { runAction } from "@/lib/auth/run-action";
import { donationInputSchema } from "./schema";
import * as service from "./service";

export const saveDonationAction = async (input: unknown) =>
  runAction(async ({ ctx }) => ({ id: await service.saveDonation(ctx, donationInputSchema.parse(input)) }));

export const deleteDonationAction = async (id: unknown) =>
  runAction(async ({ ctx }) => service.deleteDonation(ctx, z.string().min(1).parse(id)));
