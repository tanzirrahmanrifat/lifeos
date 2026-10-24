"use server";

import { z } from "zod";
import { runAction } from "@/lib/auth/run-action";
import { globalSearch } from "./service";

export const globalSearchAction = async (q: unknown) =>
  runAction(async ({ ctx }) => {
    const query = z.string().max(100).parse(q);
    return globalSearch(ctx, query);
  });
