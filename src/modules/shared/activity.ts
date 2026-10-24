import type { Prisma } from "@/generated/prisma/client";

export type ActivityAction = "client_created" | "project_created" | "invoice_created" | "invoice_sent" | "payment_recorded" | "payment_voided";

/** Minimal shape needed to write an activity row — satisfied by both the tenant-scoped client and a `$transaction` callback's `tx`. */
interface ActivityWriter {
  activityLog: { create: (args: { data: { userId: string; entityType: string; entityId: string; action: string; meta?: Prisma.InputJsonValue } }) => unknown };
}

/** Appends one line to a record's activity history. Best-effort: called inside the same DB transaction where possible. */
export function logActivity(db: ActivityWriter, userId: string, entityType: string, entityId: string, action: ActivityAction, meta?: Record<string, unknown>) {
  return db.activityLog.create({ data: { userId, entityType, entityId, action, meta: (meta as Prisma.InputJsonValue) ?? undefined } });
}
