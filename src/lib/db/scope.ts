/**
 * Tenant isolation.
 *
 * `forUser(userId)` returns a Prisma client that injects `userId` into every read, update, delete
 * and create for user-owned models, so a service cannot read or write another user's rows even if
 * it forgets a `where`. Still the caller's responsibility (and tested per module):
 *  1. foreign keys passed in (clientId, accountId, …) must be verified as owned by the same user,
 *  2. raw SQL bypasses this layer and must never touch user-owned tables without a userId predicate,
 *  3. create calls use scalar FKs, not a nested `connect` on `user`.
 */

/** Prisma model names that carry a `userId` column and are scoped automatically. */
export const USER_SCOPED_MODELS: ReadonlySet<string> = new Set([
  "UserSettings",
  "BusinessProfile",
  "Category",
  "Tag",
  "Account",
  "Transaction",
  "Transfer",
  "Budget",
  "FinancialGoal",
  "SavingsContribution",
  "Task",
  "Habit",
  "HabitLog",
  "Goal",
  "CalendarEvent",
  "Note",
  "Client",
  "Project",
  "Invoice",
  "Payment",
  "NumberSequence",
  "Attachment",
  "Notification",
  "ActivityLog",
]);

type Args = Record<string, unknown>;

const FILTER_OPS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "updateManyAndReturn",
  "deleteMany",
]);
/** Operations whose `where` must stay a unique filter, so userId is merged at the top level. */
const UNIQUE_OPS = new Set(["findUnique", "findUniqueOrThrow", "update", "delete", "upsert"]);
const CREATE_OPS = new Set(["create", "createMany", "createManyAndReturn"]);

function assertNoForeignUserId(data: unknown, userId: string) {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if ("user" in d) throw new Error("Tenant scope: do not connect `user` manually; userId is injected.");
    if ("userId" in d && d.userId !== userId) throw new Error("Tenant scope: userId mismatch in write payload.");
  }
}

/** Pure function so the isolation rules can be unit-tested without a database. */
export function scopeOperation(operation: string, args: Args | undefined, userId: string): Args {
  const a: Args = { ...(args ?? {}) };

  if (FILTER_OPS.has(operation)) {
    if (operation.startsWith("update")) assertNoForeignUserId(a.data, userId);
    a.where = a.where ? { AND: [a.where, { userId }] } : { userId };
    return a;
  }

  if (UNIQUE_OPS.has(operation)) {
    a.where = { ...(a.where as Args | undefined), userId };
    if (operation === "update") assertNoForeignUserId(a.data, userId);
    if (operation === "upsert") {
      assertNoForeignUserId(a.update, userId);
      assertNoForeignUserId(a.create, userId);
      a.create = { ...(a.create as Args), userId };
    }
    return a;
  }

  if (CREATE_OPS.has(operation)) {
    if (Array.isArray(a.data)) {
      a.data = a.data.map((row) => {
        assertNoForeignUserId(row, userId);
        return { ...row, userId };
      });
    } else {
      assertNoForeignUserId(a.data, userId);
      a.data = { ...(a.data as Args), userId };
    }
    return a;
  }

  // Fail closed: an operation we haven't reasoned about must not run unscoped.
  throw new Error(`Tenant scope: operation "${operation}" is not allowed on user-owned models.`);
}

