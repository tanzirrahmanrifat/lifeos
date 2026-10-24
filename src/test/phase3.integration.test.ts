/**
 * Phase 3 integration tests (accounts, transactions, transfers, budgets, financial goals) against
 * a real Postgres. Balance integrity is the highest-risk logic in this phase, so it's covered from
 * several angles: create, edit (including moving accounts/types), delete, and concurrent writes.
 *   TEST_DATABASE_URL=postgresql://… npm test
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d("phase 3 (real database)", () => {
  let idA = "";
  let idB = "";
  const stamp = Date.now();
  const emails = [`p3a-${stamp}@test.local`, `p3b-${stamp}@test.local`];
  const today = "2026-09-22";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let m: any;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.REGISTRATION_MODE = "open";
    m = {
      prisma: (await import("@/lib/db/client")).prisma,
      auth: await import("@/modules/auth/service"),
      finance: await import("@/modules/finance/service"),
      goals: await import("@/modules/financial-goals/service"),
      settings: await import("@/modules/settings/service"),
      schemas: {
        account: (await import("@/modules/finance/schema")).accountInputSchema,
        txn: (await import("@/modules/finance/schema")).transactionInputSchema,
        transfer: (await import("@/modules/finance/schema")).transferInputSchema,
      },
    };
    const reg = (email: string, ip: string) =>
      m.auth.registerUser({ name: "T", email, password: "correct horse battery", confirmPassword: "correct horse battery", baseCurrency: "USD", timezone: "UTC" }, ip);
    idA = await reg(emails[0]!, `10.8.${stamp % 250}.1`);
    idB = await reg(emails[1]!, `10.8.${stamp % 250}.2`);
  });

  afterAll(async () => {
    await m.prisma.user.deleteMany({ where: { email: { in: emails } } });
  });

  const bal = async (accountId: string) => (await m.prisma.account.findUniqueOrThrow({ where: { id: accountId } })).currentBalanceMinor as bigint;

  describe("accounts", () => {
    it("opens with the entered opening balance as both opening and current", async () => {
      const u = { userId: idA };
      const id = await m.finance.saveAccount(u, { name: "Cash", type: "CASH", currency: "USD", openingBalance: "100.00", isSavings: false });
      const a = await m.finance.getAccount(u, id);
      expect(a.balance).toEqual({ minor: "10000", currency: "USD" });
    });

    it("refuses a currency change once the account has activity, but allows it before", async () => {
      const u = { userId: idA };
      const id = await m.finance.saveAccount(u, { name: "Empty", type: "BANK", currency: "USD", openingBalance: "0", isSavings: false });
      await m.finance.saveAccount(u, { id, name: "Empty", type: "BANK", currency: "EUR", isSavings: false, openingBalance: "0" });
      expect((await m.finance.getAccount(u, id)).currency).toBe("EUR");

      await m.finance.saveTransaction(u, { type: "INCOME", accountId: id, amount: "10", date: today, categoryId: null, vendor: null, source: null, notes: null });
      await expect(m.finance.saveAccount(u, { id, name: "Empty", type: "BANK", currency: "USD", isSavings: false, openingBalance: "0" })).rejects.toMatchObject({ code: "VALIDATION" });
    });

    it("blocks deleting an account with transactions, but allows archiving and deleting an empty one", async () => {
      const u = { userId: idA };
      const withTxn = await m.finance.saveAccount(u, { name: "Busy", type: "CASH", currency: "USD", openingBalance: "0", isSavings: false });
      await m.finance.saveTransaction(u, { type: "INCOME", accountId: withTxn, amount: "5", date: today, categoryId: null, vendor: null, source: null, notes: null });
      await expect(m.finance.deleteAccount(u, withTxn)).rejects.toMatchObject({ code: "CONFLICT" });
      await m.finance.archiveAccount(u, withTxn, true);
      expect((await m.finance.getAccount(u, withTxn)).archived).toBe(true);

      const empty = await m.finance.saveAccount(u, { name: "Never used", type: "CASH", currency: "USD", openingBalance: "0", isSavings: false });
      await m.finance.deleteAccount(u, empty);
      expect(await m.finance.getAccount(u, empty)).toBeNull();
    });
  });

  describe("transaction balance integrity", () => {
    it("income increases and expense decreases the account balance exactly", async () => {
      const u = { userId: idA };
      const acc = await m.finance.saveAccount(u, { name: "Checking", type: "BANK", currency: "USD", openingBalance: "1000.00", isSavings: false });
      await m.finance.saveTransaction(u, { type: "INCOME", accountId: acc, amount: "250.50", date: today, categoryId: null, vendor: null, source: "Client", notes: null });
      expect(await bal(acc)).toBe(125050n);
      await m.finance.saveTransaction(u, { type: "EXPENSE", accountId: acc, amount: "80.25", date: today, categoryId: null, vendor: "Shop", source: null, notes: null });
      expect(await bal(acc)).toBe(117025n);
    });

    it("editing an amount adjusts the balance by exactly the difference", async () => {
      const u = { userId: idA };
      const acc = await m.finance.saveAccount(u, { name: "Edit acc", type: "CASH", currency: "USD", openingBalance: "0", isSavings: false });
      const id = await m.finance.saveTransaction(u, { type: "EXPENSE", accountId: acc, amount: "50", date: today, categoryId: null, vendor: null, source: null, notes: null });
      expect(await bal(acc)).toBe(-5000n);
      await m.finance.saveTransaction(u, { id, type: "EXPENSE", accountId: acc, amount: "30", date: today, categoryId: null, vendor: null, source: null, notes: null });
      expect(await bal(acc)).toBe(-3000n);
    });

    it("editing a transaction to switch account or type moves the balance correctly on both sides", async () => {
      const u = { userId: idA };
      const accX = await m.finance.saveAccount(u, { name: "X", type: "CASH", currency: "USD", openingBalance: "0", isSavings: false });
      const accY = await m.finance.saveAccount(u, { name: "Y", type: "CASH", currency: "USD", openingBalance: "0", isSavings: false });
      const id = await m.finance.saveTransaction(u, { type: "EXPENSE", accountId: accX, amount: "40", date: today, categoryId: null, vendor: null, source: null, notes: null });
      expect(await bal(accX)).toBe(-4000n);
      await m.finance.saveTransaction(u, { id, type: "INCOME", accountId: accY, amount: "40", date: today, categoryId: null, vendor: null, source: null, notes: null });
      expect(await bal(accX)).toBe(0n); // fully reversed
      expect(await bal(accY)).toBe(4000n);
    });

    it("deleting a transaction reverses exactly its own effect", async () => {
      const u = { userId: idA };
      const acc = await m.finance.saveAccount(u, { name: "Del acc", type: "CASH", currency: "USD", openingBalance: "20", isSavings: false });
      const id1 = await m.finance.saveTransaction(u, { type: "INCOME", accountId: acc, amount: "10", date: today, categoryId: null, vendor: null, source: null, notes: null });
      await m.finance.saveTransaction(u, { type: "EXPENSE", accountId: acc, amount: "5", date: today, categoryId: null, vendor: null, source: null, notes: null });
      expect(await bal(acc)).toBe(2500n);
      await m.finance.deleteTransaction(u, id1);
      expect(await bal(acc)).toBe(1500n);
      expect(await m.finance.getTransaction(u, id1)).toBeNull();
    });

    it("survives 20 concurrent transactions on the same account without losing an update", async () => {
      const u = { userId: idA };
      const acc = await m.finance.saveAccount(u, { name: "Concurrent", type: "CASH", currency: "USD", openingBalance: "0", isSavings: false });
      await Promise.all(Array.from({ length: 20 }, () => m.finance.saveTransaction(u, { type: "INCOME", accountId: acc, amount: "1.00", date: today, categoryId: null, vendor: null, source: null, notes: null })));
      expect(await bal(acc)).toBe(2000n);
    });

    it("rejects zero and negative amounts, and amounts with too many decimals for the currency", async () => {
      const u = { userId: idA };
      const acc = await m.finance.saveAccount(u, { name: "Validation", type: "CASH", currency: "JPY", openingBalance: "0", isSavings: false });
      await expect(m.finance.saveTransaction(u, { type: "INCOME", accountId: acc, amount: "0", date: today, categoryId: null, vendor: null, source: null, notes: null })).rejects.toMatchObject({ code: "VALIDATION" });
      await expect(m.finance.saveTransaction(u, { type: "INCOME", accountId: acc, amount: "-5", date: today, categoryId: null, vendor: null, source: null, notes: null })).rejects.toMatchObject({ code: "VALIDATION" });
      await expect(m.finance.saveTransaction(u, { type: "INCOME", accountId: acc, amount: "5.50", date: today, categoryId: null, vendor: null, source: null, notes: null })).rejects.toMatchObject({ code: "VALIDATION" });
    });

    it("rejects a category of the wrong type or owned by someone else", async () => {
      const u = { userId: idA };
      const acc = await m.finance.saveAccount(u, { name: "Cat check", type: "CASH", currency: "USD", openingBalance: "0", isSavings: false });
      const incomeCats = await m.settings.listCategoriesOfType(u, "INCOME");
      await expect(
        m.finance.saveTransaction(u, { type: "EXPENSE", accountId: acc, amount: "1", date: today, categoryId: incomeCats[0].id, vendor: null, source: null, notes: null }),
      ).rejects.toMatchObject({ code: "VALIDATION" });

      const catsB = await m.settings.listCategoriesOfType({ userId: idB }, "EXPENSE");
      await expect(
        m.finance.saveTransaction(u, { type: "EXPENSE", accountId: acc, amount: "1", date: today, categoryId: catsB[0].id, vendor: null, source: null, notes: null }),
      ).rejects.toMatchObject({ code: "VALIDATION" });
    });

    it("keeps every user's ledger private", async () => {
      const acc = await m.finance.saveAccount({ userId: idA }, { name: "Private", type: "CASH", currency: "USD", openingBalance: "0", isSavings: false });
      const id = await m.finance.saveTransaction({ userId: idA }, { type: "INCOME", accountId: acc, amount: "1", date: today, categoryId: null, vendor: null, source: null, notes: null });
      expect(await m.finance.getAccount({ userId: idB }, acc)).toBeNull();
      expect(await m.finance.getTransaction({ userId: idB }, id)).toBeNull();
      await expect(m.finance.saveTransaction({ userId: idB }, { type: "INCOME", accountId: acc, amount: "1", date: today, categoryId: null, vendor: null, source: null, notes: null })).rejects.toMatchObject({ code: "VALIDATION" });
      await expect(m.finance.deleteTransaction({ userId: idB }, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("filters, searches and paginates the ledger", async () => {
      const u = { userId: idB };
      const acc = await m.finance.saveAccount(u, { name: "List acc", type: "CASH", currency: "USD", openingBalance: "0", isSavings: false });
      for (let i = 0; i < 5; i++) await m.finance.saveTransaction(u, { type: "EXPENSE", accountId: acc, amount: "1", date: "2026-09-01", categoryId: null, vendor: `Vendor${i}`, source: null, notes: null });
      await m.finance.saveTransaction(u, { type: "INCOME", accountId: acc, amount: "1", date: "2026-09-02", categoryId: null, vendor: null, source: "Findable text", notes: null });
      const all = await m.finance.listTransactions(u, { page: 1 });
      expect(all.total).toBe(6);
      const income = await m.finance.listTransactions(u, { type: "INCOME", page: 1 });
      expect(income.items.length).toBe(1);
      const search = await m.finance.listTransactions(u, { q: "Findable", page: 1 });
      expect(search.items.length).toBe(1);
    });
  });

  describe("transfers", () => {
    it("moves money between two same-currency accounts exactly", async () => {
      const u = { userId: idA };
      const from = await m.finance.saveAccount(u, { name: "T-From", type: "CASH", currency: "USD", openingBalance: "100", isSavings: false });
      const to = await m.finance.saveAccount(u, { name: "T-To", type: "SAVINGS", currency: "USD", openingBalance: "0", isSavings: true });
      const id = await m.finance.saveTransfer(u, { fromAccountId: from, toAccountId: to, amountFrom: "40", amountTo: "40", date: today, notes: null });
      expect(await bal(from)).toBe(6000n);
      expect(await bal(to)).toBe(4000n);
      const legs = await m.prisma.transaction.findMany({ where: { transferId: id } });
      expect(legs.map((l: { type: string }) => l.type).sort()).toEqual(["TRANSFER_IN", "TRANSFER_OUT"]);
    });

    it("forces the destination amount to match the source amount for same-currency transfers", async () => {
      const u = { userId: idA };
      const from = await m.finance.saveAccount(u, { name: "Same1", type: "CASH", currency: "USD", openingBalance: "100", isSavings: false });
      const to = await m.finance.saveAccount(u, { name: "Same2", type: "CASH", currency: "USD", openingBalance: "0", isSavings: false });
      await m.finance.saveTransfer(u, { fromAccountId: from, toAccountId: to, amountFrom: "25", amountTo: "999", date: today, notes: null });
      expect(await bal(to)).toBe(2500n); // amountTo input is ignored when currencies match
    });

    it("supports a different amount for cross-currency transfers", async () => {
      const u = { userId: idA };
      const from = await m.finance.saveAccount(u, { name: "USD acc", type: "CASH", currency: "USD", openingBalance: "100", isSavings: false });
      const to = await m.finance.saveAccount(u, { name: "EUR acc", type: "CASH", currency: "EUR", openingBalance: "0", isSavings: false });
      await m.finance.saveTransfer(u, { fromAccountId: from, toAccountId: to, amountFrom: "50", amountTo: "46", date: today, notes: null });
      expect(await bal(from)).toBe(5000n);
      expect(await bal(to)).toBe(4600n);
    });

    it("rejects transferring an account to itself", async () => {
      const u = { userId: idA };
      const acc = await m.finance.saveAccount(u, { name: "Self", type: "CASH", currency: "USD", openingBalance: "0", isSavings: false });
      expect(m.schemas.transfer.safeParse({ fromAccountId: acc, toAccountId: acc, amountFrom: "1", amountTo: "1", date: today, notes: "" }).success).toBe(false);
    });

    it("deleting a transfer reverses both sides and removes its legs", async () => {
      const u = { userId: idA };
      const from = await m.finance.saveAccount(u, { name: "RevFrom", type: "CASH", currency: "USD", openingBalance: "100", isSavings: false });
      const to = await m.finance.saveAccount(u, { name: "RevTo", type: "CASH", currency: "USD", openingBalance: "0", isSavings: false });
      const id = await m.finance.saveTransfer(u, { fromAccountId: from, toAccountId: to, amountFrom: "30", amountTo: "30", date: today, notes: null });
      await m.finance.deleteTransfer(u, id);
      expect(await bal(from)).toBe(10000n);
      expect(await bal(to)).toBe(0n);
      expect(await m.prisma.transaction.count({ where: { transferId: id } })).toBe(0);
    });
  });

  describe("budgets", () => {
    it("compares spend against per-category budgets for one month", async () => {
      const u = { userId: idB };
      const { settings } = await m.settings.getSettingsBundle(u);
      const cats = await m.settings.listCategoriesOfType(u, "EXPENSE");
      const food = cats.find((c: { name: string }) => c.name === "Food");
      const acc = await m.finance.saveAccount(u, { name: "Budget acc", type: "CASH", currency: settings.baseCurrency, openingBalance: "0", isSavings: false });

      await m.finance.saveBudget(u, { month: "2026-10", incomeTarget: "5000", savingsTarget: "500", expenseLines: [{ categoryId: food.id, amount: "300" }] }, settings.baseCurrency);
      await m.finance.saveTransaction(u, { type: "EXPENSE", accountId: acc, amount: "220", date: "2026-10-05", categoryId: food.id, vendor: null, source: null, notes: null });
      await m.finance.saveTransaction(u, { type: "INCOME", accountId: acc, amount: "4800", date: "2026-10-01", categoryId: null, vendor: null, source: null, notes: null });

      const summary = await m.finance.getBudgetSummary(u, "2026-10", settings.baseCurrency);
      expect(summary.incomeTarget.minor).toBe("500000");
      expect(summary.incomeActual.minor).toBe("480000");
      const foodLine = summary.expenseLines.find((l: { categoryName: string }) => l.categoryName === "Food");
      expect(foodLine.spent.minor).toBe("22000");
      expect(foodLine.budget.minor).toBe("30000");
    });

    it("re-saving a budget replaces the previous month's lines instead of duplicating them", async () => {
      const u = { userId: idB };
      const { settings } = await m.settings.getSettingsBundle(u);
      const cats = await m.settings.listCategoriesOfType(u, "EXPENSE");
      const food = cats.find((c: { name: string }) => c.name === "Food");
      await m.finance.saveBudget(u, { month: "2026-11", incomeTarget: "100", savingsTarget: "0", expenseLines: [{ categoryId: food.id, amount: "50" }] }, settings.baseCurrency);
      await m.finance.saveBudget(u, { month: "2026-11", incomeTarget: "200", savingsTarget: "0", expenseLines: [{ categoryId: food.id, amount: "75" }] }, settings.baseCurrency);
      const summary = await m.finance.getBudgetSummary(u, "2026-11", settings.baseCurrency);
      expect(summary.incomeTarget.minor).toBe("20000");
      const foodLines = summary.expenseLines.filter((l: { categoryName: string }) => l.categoryName === "Food");
      expect(foodLines.length).toBe(1);
      expect(foodLines[0].budget.minor).toBe("7500");
    });
  });

  describe("financial goals", () => {
    it("tracks progress from contributions and computes required monthly saving", async () => {
      const u = { userId: idA };
      const id = await m.goals.saveFinancialGoal(u, { name: "Emergency fund", targetAmount: "10000", targetDate: "2027-09-22", categoryId: null, priority: "HIGH", status: "ACTIVE", notes: null }, "USD");
      await m.goals.addContribution(u, { goalId: id, amount: "6500", date: today, sourceAccountId: null, notes: null });
      const g = await m.goals.getFinancialGoal(u, id, today);
      expect(g.current.minor).toBe("650000");
      expect(g.remaining.minor).toBe("350000");
      expect(g.progressPct).toBe(65);
      expect(Number(g.requiredMonthly.minor)).toBeGreaterThan(0);
    });

    it("marks a goal achieved when contributions reach the target, and reverts on deletion", async () => {
      const u = { userId: idA };
      const id = await m.goals.saveFinancialGoal(u, { name: "New laptop", targetAmount: "1000", targetDate: null, categoryId: null, priority: "MEDIUM", status: "ACTIVE", notes: null }, "USD");
      const contribId = await (async () => {
        await m.goals.addContribution(u, { goalId: id, amount: "1000", date: today, sourceAccountId: null, notes: null });
        const g = await m.goals.getFinancialGoal(u, id, today);
        return g.contributions[0].id;
      })();
      expect((await m.goals.getFinancialGoal(u, id, today)).status).toBe("ACHIEVED");
      await m.goals.deleteContribution(u, id, contribId);
      const after = await m.goals.getFinancialGoal(u, id, today);
      expect(after.status).toBe("ACTIVE");
      expect(after.current.minor).toBe("0");
    });

    it("a contribution linked to an account moves real money out of it", async () => {
      const u = { userId: idA };
      const acc = await m.finance.saveAccount(u, { name: "Savings src", type: "SAVINGS", currency: "USD", openingBalance: "500", isSavings: true });
      const goalId = await m.goals.saveFinancialGoal(u, { name: "Travel", targetAmount: "2000", targetDate: null, categoryId: null, priority: "LOW", status: "ACTIVE", notes: null }, "USD");
      await m.goals.addContribution(u, { goalId, amount: "300", date: today, sourceAccountId: acc, notes: null });
      expect(await bal(acc)).toBe(20000n);
      const g = await m.goals.getFinancialGoal(u, goalId, today);
      await m.goals.deleteContribution(u, goalId, g.contributions[0].id);
      expect(await bal(acc)).toBe(50000n);
    });

    it("rejects a source account whose currency doesn't match the goal", async () => {
      const u = { userId: idA };
      const eurAcc = await m.finance.saveAccount(u, { name: "EUR src", type: "CASH", currency: "EUR", openingBalance: "100", isSavings: false });
      const goalId = await m.goals.saveFinancialGoal(u, { name: "USD goal", targetAmount: "500", targetDate: null, categoryId: null, priority: "LOW", status: "ACTIVE", notes: null }, "USD");
      await expect(m.goals.addContribution(u, { goalId, amount: "10", date: today, sourceAccountId: eurAcc, notes: null })).rejects.toMatchObject({ code: "VALIDATION" });
    });

    it("stays private per user", async () => {
      const id = await m.goals.saveFinancialGoal({ userId: idA }, { name: "Private goal", targetAmount: "100", targetDate: null, categoryId: null, priority: "LOW", status: "ACTIVE", notes: null }, "USD");
      expect(await m.goals.getFinancialGoal({ userId: idB }, id, today)).toBeNull();
      await expect(m.goals.deleteFinancialGoal({ userId: idB }, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });
});
