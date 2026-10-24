/**
 * Phase 6 integration tests (financial/business/productivity reports and date-range resolution)
 * against a real Postgres.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d("phase 6 (real database)", () => {
  let idA = "";
  let idB = "";
  const stamp = Date.now();
  const emails = [`p6a-${stamp}@test.local`, `p6b-${stamp}@test.local`];
  const today = "2026-09-23";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let m: any;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.REGISTRATION_MODE = "open";
    m = {
      prisma: (await import("@/lib/db/client")).prisma,
      auth: await import("@/modules/auth/service"),
      finance: await import("@/modules/finance/service"),
      clients: await import("@/modules/clients/service"),
      projects: await import("@/modules/projects/service"),
      invoices: await import("@/modules/invoices/service"),
      payments: await import("@/modules/payments/service"),
      tasks: await import("@/modules/tasks/service"),
      habits: await import("@/modules/habits/service"),
      goals: await import("@/modules/goals/service"),
      settings: await import("@/modules/settings/service"),
      reports: await import("@/modules/reports/service"),
    };
    const reg = (email: string, ip: string) => m.auth.registerUser({ name: "T", email, password: "correct horse battery", confirmPassword: "correct horse battery", baseCurrency: "USD", timezone: "UTC" }, ip);
    idA = await reg(emails[0]!, `10.5.${stamp % 250}.1`);
    idB = await reg(emails[1]!, `10.5.${stamp % 250}.2`);
  });

  afterAll(async () => {
    await m.prisma.user.deleteMany({ where: { email: { in: emails } } });
  });

  const range = { from: "2026-09-01", to: "2026-09-30", label: "This month" };
  const invoiceInput = (clientId: string, over: Record<string, unknown> = {}) => ({ clientId, projectId: null, issueDate: today, dueDate: "2026-10-07", currency: "USD", notes: null, paymentTerms: null, items: [{ description: "Work", quantity: "1", rate: "500", discountPercent: 0, taxPercent: 0 }], ...over });

  describe("financial report", () => {
    it("sums income, expenses, net, by-category and by-client within the range only", async () => {
      const u = { userId: idA };
      const acc = await m.finance.saveAccount(u, { name: "Report acc", type: "BANK", currency: "USD", openingBalance: "0", isSavings: false });
      const client = await m.clients.saveClient(u, { name: "Report client", company: null, email: null, phone: null, website: null, address: null, country: null, status: "ACTIVE", notes: null });
      const cats = await m.settings.listCategoriesOfType(u, "EXPENSE");
      await m.finance.saveTransaction(u, { type: "INCOME", accountId: acc, amount: "1000", date: "2026-09-10", categoryId: null, vendor: null, source: null, notes: null });
      await m.finance.saveTransaction(u, { type: "EXPENSE", accountId: acc, amount: "200", date: "2026-09-11", categoryId: cats[0].id, vendor: null, source: null, notes: null });
      await m.finance.saveTransaction(u, { type: "EXPENSE", accountId: acc, amount: "50", date: "2026-08-01", categoryId: cats[0].id, vendor: null, source: null, notes: null }); // outside range

      const invId = await m.invoices.saveInvoice(u, invoiceInput(client));
      await m.invoices.setInvoiceStatus(u, invId, "SENT");
      await m.payments.recordPayment(u, { invoiceId: invId, accountId: acc, amount: "500", date: "2026-09-15", method: "CASH", reference: null, notes: null });

      const report = await m.reports.getFinancialReport(u, range, "USD");
      expect(report.income.minor).toBe("150000"); // 1000 manual + 500 from payment
      expect(report.expenses.minor).toBe("20000"); // the August expense is excluded
      expect(report.net.minor).toBe("130000");
      expect(report.expenseByCategory[0].amount.minor).toBe("20000");
      expect(report.incomeByClient[0].name).toBe("Report client");
      expect(report.incomeByClient[0].amount.minor).toBe("50000");
      const sept = report.monthly.find((mm: { month: string }) => mm.month === "2026-09");
      expect(sept.income.minor).toBe("150000");
    });

    it("counts savings contributions within the range", async () => {
      const u = { userId: idA };
      const financialGoals = await import("@/modules/financial-goals/service");
      const goalId = await financialGoals.saveFinancialGoal(u, { name: "Report goal", targetAmount: "1000", targetDate: null, categoryId: null, priority: "LOW", status: "ACTIVE", notes: null }, "USD");
      await financialGoals.addContribution(u, { goalId, amount: "75", date: "2026-09-20", sourceAccountId: null, notes: null });
      const report = await m.reports.getFinancialReport(u, range, "USD");
      expect(Number(report.savingsContributed.minor)).toBeGreaterThanOrEqual(7500);
    });

    it("keeps reports private per user", async () => {
      const report = await m.reports.getFinancialReport({ userId: idB }, range, "USD");
      expect(report.income.minor).toBe("0");
      expect(report.incomeByClient).toEqual([]);
    });
  });

  describe("business report", () => {
    it("lists client revenue, project revenue and buckets invoices by outstanding/paid/overdue", async () => {
      const u = { userId: idB };
      const acc = await m.finance.saveAccount(u, { name: "Biz report acc", type: "BUSINESS", currency: "USD", openingBalance: "0", isSavings: false });
      const client = await m.clients.saveClient(u, { name: "Biz report client", company: null, email: null, phone: null, website: null, address: null, country: null, status: "ACTIVE", notes: null });
      const project = await m.projects.saveProject(u, { clientId: client, name: "Biz report project", description: null, startDate: null, deadline: null, budget: "", currency: "USD", status: "ACTIVE", progress: 0, notes: null });

      const paidInv = await m.invoices.saveInvoice(u, invoiceInput(client, { projectId: project, issueDate: "2026-09-05" }));
      await m.invoices.setInvoiceStatus(u, paidInv, "SENT");
      await m.payments.recordPayment(u, { invoiceId: paidInv, accountId: acc, amount: "500", date: "2026-09-06", method: "CASH", reference: null, notes: null });

      const overdueInv = await m.invoices.saveInvoice(u, invoiceInput(client, { issueDate: "2026-09-02", dueDate: "2026-09-05" }));
      await m.invoices.setInvoiceStatus(u, overdueInv, "SENT");

      const futureInv = await m.invoices.saveInvoice(u, invoiceInput(client, { issueDate: "2026-09-10", dueDate: "2026-12-01" }));
      await m.invoices.setInvoiceStatus(u, futureInv, "SENT");

      const report = await m.reports.getBusinessReport(u, range, today, "USD");
      expect(report.clientRevenue[0].name).toBe("Biz report client");
      expect(report.clientRevenue[0].revenue.minor).toBe("50000");
      expect(report.projectRevenue[0].revenue.minor).toBe("50000");
      expect(report.paidInvoices.map((i: { id: string }) => i.id)).toEqual([paidInv]);
      expect(report.overdueInvoices.map((i: { id: string }) => i.id)).toEqual([overdueInv]);
      expect(report.outstandingInvoices.map((i: { id: string }) => i.id).sort()).toEqual([futureInv, overdueInv].sort());
    });

    it("keeps business reports private per user", async () => {
      const report = await m.reports.getBusinessReport({ userId: idA }, range, today, "USD");
      expect(report.clientRevenue.some((r: { name: string }) => r.name === "Biz report client")).toBe(false);
    });
  });

  describe("productivity report", () => {
    it("counts tasks completed/created within the range and reports habit completion", async () => {
      const u = { userId: idA };
      const t1 = await m.tasks.saveTask(u, { title: "R-done", description: null, status: "TODO", priority: "MEDIUM", startDate: null, dueDate: null, categoryId: null, projectId: null, tags: [], repeat: "NONE", repeatInterval: 1, repeatUnit: "DAYS", notes: null, subtasks: [] });
      await m.tasks.setTaskStatus(u, t1, "COMPLETED");
      await m.tasks.saveTask(u, { title: "R-open", description: null, status: "TODO", priority: "MEDIUM", startDate: null, dueDate: null, categoryId: null, projectId: null, tags: [], repeat: "NONE", repeatInterval: 1, repeatUnit: "DAYS", notes: null, subtasks: [] });

      const habitId = await m.habits.saveHabit(u, { name: "Report habit", description: null, frequency: "DAILY", weekdays: [], targetPerPeriod: 1, startDate: "2026-09-01", endDate: null, reminderTime: null, categoryId: null, color: "#0e6b5c", icon: "check" });
      const clock = { timeZone: "UTC", today, weekStartsOn: 1 };
      for (const day of ["2026-09-20", "2026-09-21", "2026-09-22", "2026-09-23"]) await m.habits.toggleHabitLog(u, habitId, day, clock);

      const report = await m.reports.getProductivityReport(u, range);
      expect(report.tasksCompleted).toBeGreaterThanOrEqual(1);
      expect(report.tasksCreated).toBeGreaterThanOrEqual(2);
      expect(report.habitCompletionRate).not.toBeNull();
      expect(report.dailyCompletions.length).toBe(30); // September has 30 days
      const totalFromDaily = report.dailyCompletions.reduce((s: number, d: { count: number }) => s + d.count, 0);
      expect(totalFromDaily).toBe(report.tasksCompleted);
    });

    it("keeps productivity reports private per user", async () => {
      const report = await m.reports.getProductivityReport({ userId: idB }, range);
      expect(report.tasksCompleted).toBe(0);
    });
  });
});
