import { prisma } from "@/lib/db/client";
import { getLocalNow } from "@/lib/dates";

export interface Clock {
  timeZone: string;
  /** Today's calendar day in the user's time zone, "yyyy-mm-dd". */
  today: string;
  weekStartsOn: number;
}

/** "Today" and the week start for a user — computed on the server, in *their* time zone. */
export async function getClock(userId: string): Promise<Clock> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true, settings: { select: { weekStartsOn: true } } },
  });
  const timeZone = user?.timezone ?? "UTC";
  return { timeZone, today: getLocalNow(timeZone).iso, weekStartsOn: user?.settings?.weekStartsOn ?? 1 };
}
