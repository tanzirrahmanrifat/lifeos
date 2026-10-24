import "server-only";
import { revalidatePath } from "next/cache";
import { getClock, type Clock } from "@/modules/shared/clock";
import { safeAction } from "@/lib/errors";
import { requireUser, toCtx, type Ctx } from "./require-user";

export interface ActionContext extends Clock {
  ctx: Ctx;
}

/**
 * The one way every mutating server action runs: authenticate → build the per-user context and
 * clock → run → refresh the UI. Wrong or missing session = UNAUTHORIZED, never a partial write.
 */
export async function runAction<T>(fn: (c: ActionContext) => Promise<T>) {
  return safeAction(async () => {
    const user = await requireUser();
    const ctx = toCtx(user);
    const clock = await getClock(user.id);
    const result = await fn({ ctx, ...clock });
    revalidatePath("/", "layout");
    return result;
  });
}
