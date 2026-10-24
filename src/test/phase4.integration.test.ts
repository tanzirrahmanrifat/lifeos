/**
 * Phase 4 integration tests (clients, projects, invoices, payments) against a real Postgres.
 * The invoice → payment → income → account balance → client revenue chain is the highest-risk
 * automation in the whole app, so it gets the most scrutiny here.
 *   TEST_DATABASE_URL=postgresql://… npm test
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d("phase 4 (real database)", () => {
  let idA = "";
  let idB = "";
  const stamp = Date.now();
  const emails = [`p4a-${stamp}@test.local`, `p4b-${stamp}@test.local`];
  const today = "2026-09-23";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let m: any;

  const item = (over: Record<string, unknown> = {}) => ({ description: "Work", quantity: "1", rate: "100", discountPercent: 0, taxPercent: 0, ...over });
  const invoiceInput = (clientId: string, over: Record<string, unknown> = {}) => ({
    clientId,
    projectId: null,
    issueDate: today,
    dueDate: "2026-10-07",
    currency: "USD",
    notes: null,
    paymentTerms: null,
    items: [item()],
    ...over,
  });

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
      settings: await import("@/modules/settings/service"),
      numbering: await import("@/modules/invoices/numbering"),
    };
    const reg = (email: string, ip: string) => m.auth.registerUser({ name: "T", email, password: "correct horse battery", confirmPassword: "correct horse battery", baseCurrency: "USD", timezone: "UTC" }, ip);
    idA = await reg(emails[0]!, `10.7.${stamp % 250}.1`);
    idB = await reg(emails[1]!, `10.7.${stamp % 250}.2`);
  });

  afterAll(async () => {
    await m.prisma.user.deleteMany({ where: { email: { in: emails } } });
  });

  const bal = async (accountId: string) => (await m.prisma.account.findUniqueOrThrow({ where: { id: accountId } })).currentBalanceMinor as bigint;

  describe("clients", () => {
    it("creates, lists with derived revenue/outstanding, and searches", async () => {
      const u = { userId: idA };
      const id = await m.clients.saveClient(u, { name: "Acme Co", company: "Acme", email: "hi@acme.test", phone: null, website: null, address: null, country: null, status: "ACTIVE", notes: null });
      const list = await m.clients.listClients(u, { page: 1 }, "USD");
      const acme = list.items.find((c: { id: string }) => c.id === id);
      expect(acme.totalRevenue).toEqual({ minor: "0", currency: "USD" });
      const search = await m.clients.listClients(u, { q: "Acme", page: 1 }, "USD");
      expect(search.items.length).toBe(1);
    });

    it("stays private per user", async () => {
      const id = await m.clients.saveClient({ userId: idA }, { name: "Private client", company: null, email: null, phone: null, website: null, address: null, country: null, status: "LEAD", notes: null });
      expect(await m.clients.getClient({ userId: idB }, id, "USD")).toBeNull();
      await expect(m.clients.deleteClient({ userId: idB }, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("invoice numbering", () => {
    it("starts at the configured number and increments per user, resetting per year when asked", async () => {
      const u = { userId: idB };
      await m.settings.updateInvoiceSettings(u, { invoicePrefix: "TST", invoiceNextNumber: 5, invoiceNumberPadding: 3, invoiceIncludeYear: true, invoiceResetYearly: true, defaultPaymentTermsDays: 14, defaultTaxPercent: 0, defaultInvoiceNotes: null });
      const { settings } = await m.settings.getSettingsBundle(u);
      const n1 = await m.numbering.nextInvoiceNumber(idB, settings, 2026);
      const n2 = await m.numbering.nextInvoiceNumber(idB, settings, 2026);
      const n3 = await m.numbering.nextInvoiceNumber(idB, settings, 2027);
      expect(n1).toBe("TST-2026-005");
      expect(n2).toBe("TST-2026-006");
      expect(n3).toBe("TST-2027-005"); // new year, counter starts fresh at the configured number
    });

    it("never issues the same number twice under concurrent creation", async () => {
      const u = { userId: idA };
      const { settings } = await m.settings.getSettingsBundle(u);
      const numbers = await Promise.all(Array.from({ length: 10 }, () => m.numbering.nextInvoiceNumber(idA, settings, 2030)));
      expect(new Set(numbers).size).toBe(10);
    });
  });

  describe("invoices", () => {
    it("creates a draft with server-computed totals and a unique number", async () => {
      const u = { userId: idA };
      const client = await m.clients.saveClient(u, { name: "Invoice Client", company: null, email: null, phone: null, website: null, address: null, country: null, status: "ACTIVE", notes: null });
      const id = await m.invoices.saveInvoice(u, invoiceInput(client, { items: [item({ description: "WordPress Development", rate: "800" }), item({ description: "SEO Setup", rate: "300" })] }), today);
      const inv = await m.invoices.getInvoice(u, id, today);
      expect(inv.status).toBe("DRAFT");
      expect(inv.total.minor).toBe("110000");
      expect(inv.number).toMatch(/^INV-\d{4}-\d{4}$/);
    });

    it("rejects a due date before the issue date, and a project from a different client", async () => {
      const u = { userId: idA };
      const client = await m.clients.saveClient(u, { name: "C1", company: null, email: null, phone: null, website: null, address: null, country: null, status: "ACTIVE", notes: null });
      const otherClient = await m.clients.saveClient(u, { name: "C2", company: null, email: null, phone: null, website: null, address: null, country: null, status: "ACTIVE", notes: null });
      const project = await m.projects.saveProject(u, { clientId: otherClient, name: "Other's project", description: null, startDate: null, deadline: null, budget: "", currency: "USD", status: "PLANNING", progress: 0, notes: null });
      const schemaCheck = m.invoices.invoiceInputSchema?.safeParse ?? (await import("@/modules/invoices/schema")).invoiceInputSchema.safeParse;
      expect(schemaCheck(invoiceInput(client, { dueDate: "2026-09-01" })).success).toBe(false);
      await expect(m.invoices.saveInvoice(u, invoiceInput(client, { projectId: project }), today)).rejects.toMatchObject({ code: "VALIDATION" });
    });

    it("marks sent, then blocks deleting a non-draft, and blocks re-sending", async () => {
      const u = { userId: idA };
      const client = await m.clients.saveClient(u, { name: "Sendable", company: null, email: null, phone: null, website: null, address: null, country: null, status: "ACTIVE", notes: null });
      const id = await m.invoices.saveInvoice(u, invoiceInput(client), today);
      await m.invoices.setInvoiceStatus(u, id, "SENT");
      expect((await m.invoices.getInvoice(u, id, today)).status).toBe("SENT");
      await expect(m.invoices.setInvoiceStatus(u, id, "SENT")).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(m.invoices.deleteInvoice(u, id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("shows OVERDUE only for display, without changing the stored status", async () => {
      const u = { userId: idA };
      const client = await m.clients.saveClient(u, { name: "Overdue test", company: null, email: null, phone: null, website: null, address: null, country: null, status: "ACTIVE", notes: null });
      const id = await m.invoices.saveInvoice(u, invoiceInput(client, { issueDate: "2026-01-01", dueDate: "2026-01-15" }), today);
      await m.invoices.setInvoiceStatus(u, id, "SENT");
      const inv = await m.invoices.getInvoice(u, id, today);
      expect(inv.status).toBe("SENT");
      expect(inv.displayStatus).toBe("OVERDUE");
    });

    it("keeps invoices private per user", async () => {
      const client = await m.clients.saveClient({ userId: idA }, { name: "Priv inv client", company: null, email: null, phone: null, website: null, address: null, country: null, status: "ACTIVE", notes: null });
      const id = await m.invoices.saveInvoice({ userId: idA }, invoiceInput(client), today);
      expect(await m.invoices.getInvoice({ userId: idB }, id, today)).toBeNull();
      await expect(m.invoices.setInvoiceStatus({ userId: idB }, id, "SENT")).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("payments — the full automation chain", () => {
    it("partial payment: updates invoice, creates income transaction, updates account balance and client revenue", async () => {
      const u = { userId: idA };
      const client = await m.clients.saveClient(u, { name: "Payer", company: null, email: null, phone: null, website: null, address: null, country: null, status: "ACTIVE", notes: null });
      const account = await m.finance.saveAccount(u, { name: "Biz account", type: "BUSINESS", currency: "USD", openingBalance: "0", isSavings: false });
      const invId = await m.invoices.saveInvoice(u, invoiceInput(client, { items: [item({ rate: "1000" })] }), today);
      await m.invoices.setInvoiceStatus(u, invId, "SENT");

      const payId = await m.payments.recordPayment(u, { invoiceId: invId, accountId: account, amount: "400", date: today, method: "BANK_TRANSFER", reference: null, notes: null });

      const inv = await m.invoices.getInvoice(u, invId, today);
      expect(inv.status).toBe("PARTIALLY_PAID");
      expect(inv.amountPaid.minor).toBe("40000");
      expect(inv.balanceDue.minor).toBe("60000");
      expect(await bal(account)).toBe(40000n);

      const txn = await m.prisma.transaction.findFirst({ where: { paymentId: payId } });
      expect(txn.type).toBe("INCOME");
      expect(txn.amountMinor).toBe(40000n);
      expect(txn.clientId).toBe(client);

      const clientDetail = await m.clients.getClient(u, client, "USD");
      expect(clientDetail.totalRevenue.minor).toBe("40000");
      expect(clientDetail.outstanding.minor).toBe("60000");
    });

    it("a second payment completing the balance marks the invoice PAID", async () => {
      const u = { userId: idA };
      const client = await m.clients.saveClient(u, { name: "Full payer", company: null, email: null, phone: null, website: null, address: null, country: null, status: "ACTIVE", notes: null });
      const account = await m.finance.saveAccount(u, { name: "Full pay acc", type: "BANK", currency: "USD", openingBalance: "0", isSavings: false });
      const invId = await m.invoices.saveInvoice(u, invoiceInput(client, { items: [item({ rate: "500" })] }), today);
      await m.invoices.setInvoiceStatus(u, invId, "SENT");
      await m.payments.recordPayment(u, { invoiceId: invId, accountId: account, amount: "300", date: today, method: "CASH", reference: null, notes: null });
      await m.payments.recordPayment(u, { invoiceId: invId, accountId: account, amount: "200", date: today, method: "CASH", reference: null, notes: null });
      const inv = await m.invoices.getInvoice(u, invId, today);
      expect(inv.status).toBe("PAID");
      expect(inv.balanceDue.minor).toBe("0");
      await expect(m.payments.recordPayment(u, { invoiceId: invId, accountId: account, amount: "1", date: today, method: "CASH", reference: null, notes: null })).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("rejects a payment larger than the remaining balance", async () => {
      const u = { userId: idA };
      const client = await m.clients.saveClient(u, { name: "Overpay test", company: null, email: null, phone: null, website: null, address: null, country: null, status: "ACTIVE", notes: null });
      const account = await m.finance.saveAccount(u, { name: "Overpay acc", type: "BANK", currency: "USD", openingBalance: "0", isSavings: false });
      const invId = await m.invoices.saveInvoice(u, invoiceInput(client, { items: [item({ rate: "100" })] }), today);
      await m.invoices.setInvoiceStatus(u, invId, "SENT");
      await expect(m.payments.recordPayment(u, { invoiceId: invId, accountId: account, amount: "150", date: today, method: "CASH", reference: null, notes: null })).rejects.toMatchObject({ code: "VALIDATION" });
    });

    it("rejects a payment from an account in the wrong currency, and against a draft invoice", async () => {
      const u = { userId: idA };
      const client = await m.clients.saveClient(u, { name: "Currency test", company: null, email: null, phone: null, website: null, address: null, country: null, status: "ACTIVE", notes: null });
      const eurAccount = await m.finance.saveAccount(u, { name: "EUR acc", type: "BANK", currency: "EUR", openingBalance: "0", isSavings: false });
      const usdAccount = await m.finance.saveAccount(u, { name: "USD acc", type: "BANK", currency: "USD", openingBalance: "0", isSavings: false });
      const invId = await m.invoices.saveInvoice(u, invoiceInput(client, { items: [item({ rate: "100" })] }), today);
      await expect(m.payments.recordPayment(u, { invoiceId: invId, accountId: usdAccount, amount: "10", date: today, method: "CASH", reference: null, notes: null })).rejects.toMatchObject({ code: "FORBIDDEN" }); // still draft
      await m.invoices.setInvoiceStatus(u, invId, "SENT");
      await expect(m.payments.recordPayment(u, { invoiceId: invId, accountId: eurAccount, amount: "10", date: today, method: "CASH", reference: null, notes: null })).rejects.toMatchObject({ code: "VALIDATION" });
    });

    it("voiding a payment reverses the invoice status, the account balance and the income transaction", async () => {
      const u = { userId: idA };
      const client = await m.clients.saveClient(u, { name: "Void test", company: null, email: null, phone: null, website: null, address: null, country: null, status: "ACTIVE", notes: null });
      const account = await m.finance.saveAccount(u, { name: "Void acc", type: "BANK", currency: "USD", openingBalance: "50", isSavings: false });
      const invId = await m.invoices.saveInvoice(u, invoiceInput(client, { items: [item({ rate: "200" })] }), today);
      await m.invoices.setInvoiceStatus(u, invId, "SENT");
      const payId = await m.payments.recordPayment(u, { invoiceId: invId, accountId: account, amount: "200", date: today, method: "CASH", reference: null, notes: null });
      expect((await m.invoices.getInvoice(u, invId, today)).status).toBe("PAID");
      expect(await bal(account)).toBe(25000n);

      await m.payments.voidPayment(u, payId);
      const inv = await m.invoices.getInvoice(u, invId, today);
      expect(inv.status).toBe("SENT");
      expect(inv.amountPaid.minor).toBe("0");
      expect(await bal(account)).toBe(5000n);
      const txn = await m.prisma.transaction.findFirst({ where: { paymentId: payId } });
      expect(txn.deletedAt).not.toBeNull();
    });

    it("locks an invoice's line items once it has a payment", async () => {
      const u = { userId: idA };
      const client = await m.clients.saveClient(u, { name: "Lock test", company: null, email: null, phone: null, website: null, address: null, country: null, status: "ACTIVE", notes: null });
      const account = await m.finance.saveAccount(u, { name: "Lock acc", type: "BANK", currency: "USD", openingBalance: "0", isSavings: false });
      const invId = await m.invoices.saveInvoice(u, invoiceInput(client, { items: [item({ rate: "100" })] }), today);
      await m.invoices.setInvoiceStatus(u, invId, "SENT");
      await m.payments.recordPayment(u, { invoiceId: invId, accountId: account, amount: "50", date: today, method: "CASH", reference: null, notes: null });
      await expect(m.invoices.saveInvoice(u, invoiceInput(client, { id: invId, items: [item({ rate: "999" })] }), today)).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("keeps payments private per user", async () => {
      const client = await m.clients.saveClient({ userId: idA }, { name: "Priv pay client", company: null, email: null, phone: null, website: null, address: null, country: null, status: "ACTIVE", notes: null });
      const account = await m.finance.saveAccount({ userId: idA }, { name: "Priv pay acc", type: "BANK", currency: "USD", openingBalance: "0", isSavings: false });
      const invId = await m.invoices.saveInvoice({ userId: idA }, invoiceInput(client, { items: [item({ rate: "50" })] }), today);
      await m.invoices.setInvoiceStatus({ userId: idA }, invId, "SENT");
      await expect(m.payments.recordPayment({ userId: idB }, { invoiceId: invId, accountId: account, amount: "10", date: today, method: "CASH", reference: null, notes: null })).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("projects", () => {
    it("computes revenue from paid invoices and expenses from linked transactions", async () => {
      const u = { userId: idA };
      const client = await m.clients.saveClient(u, { name: "Project client", company: null, email: null, phone: null, website: null, address: null, country: null, status: "ACTIVE", notes: null });
      const projectId = await m.projects.saveProject(u, { clientId: client, name: "Website revamp", description: null, startDate: null, deadline: null, budget: "2000", currency: "USD", status: "ACTIVE", progress: 0, notes: null });
      const account = await m.finance.saveAccount(u, { name: "Proj acc", type: "BUSINESS", currency: "USD", openingBalance: "0", isSavings: false });
      const invId = await m.invoices.saveInvoice(u, invoiceInput(client, { projectId, items: [item({ rate: "900" })] }), today);
      await m.invoices.setInvoiceStatus(u, invId, "SENT");
      await m.payments.recordPayment(u, { invoiceId: invId, accountId: account, amount: "900", date: today, method: "CASH", reference: null, notes: null });
      await m.finance.saveTransaction(u, { type: "EXPENSE", accountId: account, amount: "50", date: today, categoryId: null, vendor: "Hosting", source: null, notes: null }).then(async (txnId: string) => {
        await m.prisma.transaction.update({ where: { id: txnId }, data: { projectId } });
      });

      const project = await m.projects.getProject(u, projectId, today);
      expect(project.revenue.minor).toBe("90000");
      expect(project.expenses.minor).toBe("5000");
      expect(project.budget.minor).toBe("200000");
    });

    it("blocks deleting a project that has invoices", async () => {
      const u = { userId: idA };
      const client = await m.clients.saveClient(u, { name: "Block delete client", company: null, email: null, phone: null, website: null, address: null, country: null, status: "ACTIVE", notes: null });
      const projectId = await m.projects.saveProject(u, { clientId: client, name: "Has invoice", description: null, startDate: null, deadline: null, budget: "", currency: "USD", status: "ACTIVE", progress: 0, notes: null });
      await m.invoices.saveInvoice(u, invoiceInput(client, { projectId }), today);
      await expect(m.projects.deleteProject(u, projectId)).rejects.toMatchObject({ code: "VALIDATION" });
    });

    it("keeps projects private per user", async () => {
      const client = await m.clients.saveClient({ userId: idA }, { name: "Priv proj client", company: null, email: null, phone: null, website: null, address: null, country: null, status: "ACTIVE", notes: null });
      const projectId = await m.projects.saveProject({ userId: idA }, { clientId: client, name: "Priv project", description: null, startDate: null, deadline: null, budget: "", currency: "USD", status: "PLANNING", progress: 0, notes: null });
      expect(await m.projects.getProject({ userId: idB }, projectId, today)).toBeNull();
      await expect(m.projects.deleteProject({ userId: idB }, projectId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });
});
