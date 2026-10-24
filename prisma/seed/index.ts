/**
 * Demo/seed data — deliberately separate from production code and clearly flagged (`User.isDemo`).
 * Run with `npm run seed:demo`. It refuses to run when NODE_ENV=production.
 *
 * Phase 1 creates only the demo account and its default categories. Later phases extend this file
 * with the realistic demo dataset (clients, projects, tasks, habits, goals, transactions, invoices…).
 */
import "dotenv/config";
import { hashPassword } from "../../src/lib/auth/password";
import { prisma } from "../../src/lib/db/client";
import { DEFAULT_CATEGORIES } from "../../src/modules/settings/default-categories";

const DEMO_EMAIL = "demo@lifeos.local";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed demo data with NODE_ENV=production.");
  }
  const password = process.env.DEMO_PASSWORD ?? "demo-password-123";

  // Idempotent: wipe and recreate only the demo user (cascades to all of its data).
  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL, isDemo: true } });

  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      name: "Demo User",
      passwordHash: await hashPassword(password),
      timezone: "Asia/Dhaka",
      isDemo: true,
      settings: { create: { baseCurrency: "USD" } },
      business: { create: { name: "Demo Studio", email: "hello@demo.studio", website: "https://demo.studio" } },
      categories: { createMany: { data: DEFAULT_CATEGORIES } },
    },
    select: { id: true },
  });

  console.info(`Demo user ready → ${DEMO_EMAIL} / ${password}  (id ${user.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
