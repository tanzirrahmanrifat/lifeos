import { prisma } from "./client";
import { USER_SCOPED_MODELS, scopeOperation } from "./scope";

/** Tenant-scoped Prisma client. Rules and caveats are documented in ./scope.ts. */
export function forUser(userId: string) {
  if (!userId) throw new Error("forUser() requires a userId");
  return prisma.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!USER_SCOPED_MODELS.has(model)) return query(args);
          return query(scopeOperation(operation, args as Record<string, unknown>, userId) as typeof args);
        },
      },
    },
  });
}

export type ScopedDb = ReturnType<typeof forUser>;
