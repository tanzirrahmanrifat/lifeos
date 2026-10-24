"use server";

import { z } from "zod";
import { runAction } from "@/lib/auth/run-action";
import { invoiceInputSchema } from "./schema";
import * as service from "./service";

export const saveInvoiceAction = async (input: unknown) =>
  runAction(async ({ ctx }) => ({ id: await service.saveInvoice(ctx, invoiceInputSchema.parse(input)) }));

export const setInvoiceStatusAction = async (input: unknown) =>
  runAction(async ({ ctx }) => {
    const v = z.object({ id: z.string().min(1), status: z.enum(["SENT", "VIEWED", "CANCELLED"]) }).parse(input);
    await service.setInvoiceStatus(ctx, v.id, v.status);
  });

export const deleteInvoiceAction = async (id: unknown) =>
  runAction(async ({ ctx }) => service.deleteInvoice(ctx, z.string().min(1).parse(id)));
