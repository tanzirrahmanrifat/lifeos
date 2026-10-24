import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed/index.ts" },
  // Prisma 7's config datasource only takes one url (no separate directUrl slot). The `migrate
  // deploy` step in package.json's build script points DATABASE_URL at DIRECT_URL for that one
  // command instead — see the note there for why.
  datasource: { url: process.env.DATABASE_URL ?? "postgresql://lifeos:lifeos@localhost:5432/lifeos" },
});
