"use server";

import { z } from "zod";
import { runAction } from "@/lib/auth/run-action";
import { forgiveInputSchema, loanInputSchema, repaymentInputSchema } from "./schema";
import * as service from "./service";

export const saveLoanAction = async (input: unknown) =>
  runAction(async ({ ctx }) => ({ id: await service.saveLoan(ctx, loanInputSchema.parse(input)) }));

export const deleteLoanAction = async (id: unknown) =>
  runAction(async ({ ctx }) => service.deleteLoan(ctx, z.string().min(1).parse(id)));

export const addRepaymentAction = async (input: unknown) =>
  runAction(async ({ ctx }) => service.addRepayment(ctx, repaymentInputSchema.parse(input)));

export const deleteRepaymentAction = async (input: unknown) =>
  runAction(async ({ ctx }) => {
    const v = z.object({ loanId: z.string().min(1), repaymentId: z.string().min(1) }).parse(input);
    await service.deleteRepayment(ctx, v.loanId, v.repaymentId);
  });

export const forgiveLoanAction = async (input: unknown) =>
  runAction(async ({ ctx, today }) => service.forgiveLoan(ctx, forgiveInputSchema.parse(input), today));

export const unforgiveLoanAction = async (id: unknown) =>
  runAction(async ({ ctx }) => service.unforgiveLoan(ctx, z.string().min(1).parse(id)));
