/**
 * Integration tests against a real Postgres. They run only when TEST_DATABASE_URL points at a
 * migrated database (they create and delete their own users):
 *
 *   TEST_DATABASE_URL=postgresql://lifeos:lifeos@localhost:5432/lifeos npm test
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d("integration (real database)", () => {
  // Imported lazily so that skipping never requires a database or env.
  let m: {
    prisma: typeof import("@/lib/db/client").prisma;
    forUser: typeof import("@/lib/db/tenant").forUser;
    auth: typeof import("@/modules/auth/service");
    settings: typeof import("@/modules/settings/service");
    dash: typeof import("@/modules/dashboard/service");
    rl: typeof import("@/lib/rate-limit");
    env: typeof import("@/lib/env");
  };
  const stamp = Date.now();
  const emailA = `a-${stamp}@test.local`;
  const emailB = `b-${stamp}@test.local`;
  let ip = 0;
  const nextIp = () => `10.0.${stamp % 250}.${++ip}`;
  const reg = (email: string) => ({
    name: "Test User",
    email,
    password: "correct horse battery",
    confirmPassword: "correct horse battery",
    baseCurrency: "BDT",
    timezone: "Asia/Dhaka",
  });

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.REGISTRATION_MODE = "open";
    process.env.EMAIL_PROVIDER = "console";
    process.env.APP_URL = "http://localhost:3000";
    m = {
      prisma: (await import("@/lib/db/client")).prisma,
      forUser: (await import("@/lib/db/tenant")).forUser,
      auth: await import("@/modules/auth/service"),
      settings: await import("@/modules/settings/service"),
      dash: await import("@/modules/dashboard/service"),
      rl: await import("@/lib/rate-limit"),
      env: await import("@/lib/env"),
    };
  });

  afterAll(async () => {
    await m.prisma.user.deleteMany({ where: { email: { in: [emailA, emailB] } } });
    await m.prisma.rateLimitBucket.deleteMany({ where: { key: { contains: `-${stamp}@` } } });
    await m.prisma.rateLimitBucket.deleteMany({ where: { key: { startsWith: `t-${stamp}` } } });
  });

  let idA = "";
  let idB = "";

  it("registers a user with settings, business profile and default categories", async () => {
    idA = await m.auth.registerUser(reg(emailA), nextIp());
    idB = await m.auth.registerUser(reg(emailB), nextIp());
    const bundle = await m.settings.getSettingsBundle({ userId: idA });
    expect(bundle.user.email).toBe(emailA);
    expect(bundle.settings.baseCurrency).toBe("BDT");
    expect(bundle.settings.notificationPrefs.invoiceOverdue).toBe(true);
    const cats = await m.settings.listCategories({ userId: idA });
    expect(cats.length).toBeGreaterThanOrEqual(25);
    expect(cats.find((c) => c.name === "Client payment")?.isSystem).toBe(true);
  });

  it("rejects duplicate emails", async () => {
    await expect(m.auth.registerUser(reg(emailA), nextIp())).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("honours first-user-only registration mode", async () => {
    process.env.REGISTRATION_MODE = "first-user-only";
    m.env.resetEnvCacheForTests();
    await expect(m.auth.registerUser(reg(`c-${stamp}@test.local`), nextIp())).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await m.auth.isRegistrationOpen()).toBe(false);
    process.env.REGISTRATION_MODE = "open";
    m.env.resetEnvCacheForTests();
  });

  it("authenticates with the right password and gives one generic error otherwise", async () => {
    expect(await m.auth.authenticate(emailA, "correct horse battery", nextIp())).toBe(idA);
    const wrong = await m.auth.authenticate(emailA, "nope nope nope", nextIp()).catch((e) => e);
    const unknown = await m.auth.authenticate(`nobody-${stamp}@test.local`, "whatever whatever", nextIp()).catch((e) => e);
    expect(wrong.message).toBe("Incorrect email or password.");
    expect(unknown.message).toBe(wrong.message);
  });

  it("rate-limits repeated logins for one email", async () => {
    const email = `brute-${stamp}@test.local`;
    const results = [];
    for (let i = 0; i < 10; i++) results.push(await m.auth.authenticate(email, "guess guess guess", nextIp()).catch((e) => e));
    expect(results.slice(0, 8).every((e) => e.code === "UNAUTHORIZED")).toBe(true);
    expect(results[9].code).toBe("RATE_LIMITED");
    await m.prisma.rateLimitBucket.deleteMany({ where: { key: `login:email:${email}` } });
  });

  it("rate limiter counts within a window and starts a new one after it expires", async () => {
    const key = `t-${stamp}-window`;
    expect((await m.rl.hitRateLimit(key, 2, 60)).allowed).toBe(true);
    expect((await m.rl.hitRateLimit(key, 2, 60)).allowed).toBe(true);
    expect((await m.rl.hitRateLimit(key, 2, 60)).allowed).toBe(false);
    await m.prisma.rateLimitBucket.update({ where: { key }, data: { resetAt: new Date(Date.now() - 1000) } });
    expect((await m.rl.hitRateLimit(key, 2, 60)).allowed).toBe(true);
  });

  it("password reset: email link, single use, signs out all sessions", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await m.prisma.session.create({
      data: { userId: idA, tokenHash: `hash-${stamp}`, expiresAt: new Date(Date.now() + 100000) },
    });
    await m.auth.requestPasswordReset(emailA, nextIp());
    const logged = spy.mock.calls.map((c) => String(c[0])).join("\n");
    spy.mockRestore();
    const token = /reset-password\/([\w-]+)/.exec(logged)?.[1];
    expect(token).toBeTruthy();

    await expect(m.auth.resetPassword("x".repeat(43), "brand new password", nextIp())).rejects.toMatchObject({ code: "VALIDATION" });
    await m.auth.resetPassword(token!, "brand new password", nextIp());
    await expect(m.auth.resetPassword(token!, "another password!", nextIp())).rejects.toMatchObject({ code: "VALIDATION" });

    expect(await m.prisma.session.count({ where: { userId: idA } })).toBe(0);
    expect(await m.auth.authenticate(emailA, "brand new password", nextIp())).toBe(idA);
  });

  it("forgot-password for an unknown address resolves silently (no enumeration)", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await expect(m.auth.requestPasswordReset(`ghost-${stamp}@test.local`, nextIp())).resolves.toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("tenant scope: one user can never read or change another user's rows", async () => {
    const a = m.forUser(idA);
    const b = m.forUser(idB);
    const created = await a.category.create({ data: { userId: idA, type: "EXPENSE", name: `Secret-${stamp}` } });

    expect(await b.category.findFirst({ where: { id: created.id } })).toBeNull();
    expect(await b.category.findUnique({ where: { id: created.id } })).toBeNull();
    expect((await b.category.findMany({ where: { name: created.name } })).length).toBe(0);
    await expect(b.category.update({ where: { id: created.id }, data: { name: "hacked" } })).rejects.toThrow();
    expect((await b.category.updateMany({ where: { id: created.id }, data: { name: "hacked" } })).count).toBe(0);
    expect((await b.category.deleteMany({ where: { id: created.id } })).count).toBe(0);
    await expect(b.category.create({ data: { userId: idA, type: "EXPENSE", name: "x" } })).rejects.toThrow(/mismatch/);

    expect((await a.category.findUnique({ where: { id: created.id } }))?.name).toBe(created.name);
  });

  it("settings: preferences, invoice settings, categories rules", async () => {
    const ctx = { userId: idA };
    await m.settings.updatePreferences(ctx, { baseCurrency: "GBP", theme: "DARK", dateFormat: "yyyy-MM-dd", weekStartsOn: 0 });
    await m.settings.updateInvoiceSettings(ctx, {
      invoicePrefix: "WD",
      invoiceNextNumber: 42,
      invoiceNumberPadding: 3,
      invoiceIncludeYear: false,
      invoiceResetYearly: false,
      defaultPaymentTermsDays: 30,
      defaultTaxPercent: 1850,
      defaultInvoiceNotes: null,
    });
    const s = (await m.settings.getSettingsBundle(ctx)).settings;
    expect(s).toMatchObject({ baseCurrency: "GBP", theme: "DARK", invoicePrefix: "WD", invoiceNextNumber: 42, defaultTaxBps: 1850 });

    const cats = await m.settings.listCategories(ctx);
    const system = cats.find((c) => c.isSystem)!;
    await expect(m.settings.updateCategory(ctx, { id: system.id, name: "Renamed" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(m.settings.archiveCategory(ctx, system.id)).rejects.toMatchObject({ code: "FORBIDDEN" });

    const c = await m.settings.createCategory(ctx, { type: "EXPENSE", name: `Coffee-${stamp}` });
    await expect(m.settings.createCategory(ctx, { type: "EXPENSE", name: `Coffee-${stamp}` })).rejects.toMatchObject({ code: "CONFLICT" });
    await m.settings.archiveCategory(ctx, c.id);
    const revived = await m.settings.createCategory(ctx, { type: "EXPENSE", name: `Coffee-${stamp}` });
    expect(revived.id).toBe(c.id); // archived category comes back instead of colliding
    await expect(m.settings.archiveCategory({ userId: idB }, c.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("profile: email change needs the current password and must be unique", async () => {
    const ctx = { userId: idB };
    const base = { name: "B", phone: null, timezone: "Asia/Dhaka" };
    await expect(m.settings.updateProfile(ctx, { ...base, email: `new-${stamp}@test.local` })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      m.settings.updateProfile(ctx, { ...base, email: emailA, currentPassword: "correct horse battery" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("dashboard summary is exact and zero for a fresh workspace", async () => {
    const s = await m.dash.getDashboardSummary({ userId: idB }, "BDT", "Asia/Dhaka");
    expect(s.totalIncome).toEqual({ minor: "0", currency: "BDT" });
    expect(s.netIncome.minor).toBe("0");
    expect(s.outstandingInvoices.minor).toBe("0");
  });

  it("dashboard summary aggregates the ledger and only this user's rows", async () => {
    // Seed ledger rows directly for user B (Phase 3 services will do this through the UI).
    const acct = await m.prisma.account.create({
      data: { userId: idB, name: "Savings", type: "SAVINGS", currency: "BDT", isSavings: true, currentBalanceMinor: 250000n },
    });
    const today = new Date();
    const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    await m.prisma.transaction.createMany({
      data: [
        { userId: idB, accountId: acct.id, type: "INCOME", amountMinor: 1_000_000n, currency: "BDT", date: day },
        { userId: idB, accountId: acct.id, type: "EXPENSE", amountMinor: 333_333n, currency: "BDT", date: day },
        { userId: idB, accountId: acct.id, type: "EXPENSE", amountMinor: 1n, currency: "USD", date: day }, // other currency: excluded
      ],
    });
    const s = await m.dash.getDashboardSummary({ userId: idB }, "BDT", "UTC");
    expect(s.totalIncome.minor).toBe("1000000");
    expect(s.totalExpenses.minor).toBe("333333");
    expect(s.netIncome.minor).toBe("666667");
    expect(s.currentSavings.minor).toBe("250000");

    const other = await m.dash.getDashboardSummary({ userId: idA }, "BDT", "UTC");
    expect(other.totalIncome.minor).toBe("0");
  });
});
