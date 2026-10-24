import "server-only";
import { cache } from "react";
import { requireUserOrRedirect } from "@/lib/auth/require-user";
import { getSettingsBundle } from "./service";

/** Per-request memoised: layout and page share one round trip. Redirects to /login when signed out. */
export const getBundle = cache(async () => {
  const user = await requireUserOrRedirect();
  return getSettingsBundle({ userId: user.id });
});
