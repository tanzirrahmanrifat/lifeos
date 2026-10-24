import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  REGISTRATION_MODE: z.enum(["open", "first-user-only", "closed"]).default("first-user-only"),
  EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  EMAIL_FROM: z.string().default("LifeOS <no-reply@localhost>"),
  RESEND_API_KEY: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Validated environment, read lazily so `next build` never needs runtime secrets. */
export function getEnv(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Invalid environment configuration — ${details}`);
    }
    if (parsed.data.EMAIL_PROVIDER === "resend" && !parsed.data.RESEND_API_KEY) {
      throw new Error("Invalid environment configuration — RESEND_API_KEY is required when EMAIL_PROVIDER=resend");
    }
    cached = parsed.data;
  }
  return cached;
}

/** Test helper: forget the cached environment so a test can change process.env. */
export function resetEnvCacheForTests() {
  cached = undefined;
}
