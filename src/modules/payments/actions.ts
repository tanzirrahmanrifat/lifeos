"use server";

import { z } from "zod";
import { runAction } from "@/lib/auth/run-action";
import { paymentInputSchema } from "./schema";
import * as service from "./service";

export const recordPaymentAction = async (input: unknown) =>
  runAction(async ({ ctx }) => ({ id: await service.recordPayment(ctx, paymentInputSchema.parse(input)) }));

export const voidPaymentAction = async (id: unknown) =>
  runAction(async ({ ctx }) => service.voidPayment(ctx, z.string().min(1).parse(id)));
