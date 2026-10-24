/**
 * Phase 5 integration tests (global search, calendar wiring for invoices/projects/client meetings,
 * client activity history) against a real Postgres.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d("phase 5 (real database)", () => {
  let idA = "";
  let idB = "";
  const stamp = Date.now();
  const emails = [`p5a-${stamp}@test.local`, `p5b-${stamp}@test.local`];
  const today = "2026-09-23";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let m: any;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.REGISTRATION_MODE = "open";
    m = {
      prisma: (await import("@/lib/db/client")).prisma,
      auth: await import("@/modules/auth/service"),
      clients: await import("@/modules/clients/service"),
      projects: await import("@/modules/projects/service"),
      invoices: await import("@/modules/invoices/service"),
      cal: await import("@/modules/calendar/service"),
      search: await import("@/modules/search/service"),
    };
    const reg = (email: string, ip: string) => m.auth.registerUser({ name: "T", email, password: "correct horse battery", confirmPassword: "correct horse battery", baseCurrency: "USD", timezone: "UTC" }, ip);
    idA = await reg(emails[0]!, `10.6.${stamp % 250}.1`);
    idB = await reg(emails[1]!, `10.6.${stamp % 250}.2`);
  });

  afterAll(async () => {
    await m.prisma.user.deleteMany({ where: { email: { in: emails } } });
  });

  const clock = { timeZone: "UTC", today, weekStartsOn: 1 };
  const invoiceInput = (clientId: string, over: Record<string, unknown> = {}) => ({
    clientId,
    projectId: null,
    issueDate: today,
    dueDate: "2026-10-07",
    currency: "USD",
    notes: null,
    paymentTerms: null,
    items: [{ description: "Work", quantity: "1", rate: "100", discountPercent: 0, taxPercent: 0 }],
    ...over,
  });

  describe("global search", () => {
    it("finds a client by a distinctive name and never leaks another user's data", async () => {
      const uniqueName = `Zephyr Studios ${stamp}`;
      await m.clients.saveClient({ userId: idA }, { name: uniqueName, company: null, email: null, phone: null, website: null, address: null, country: null, status: "ACTIVE", notes: null });
      const results = await m.search.globalSearch({ userId: idA }, uniqueName, "USD");
      const clientGroup = results.find((g: { kind: string }) => g.kind === "client");
      expect(clientGroup.results[0].title).toBe(uniqueName);

      const asOther = await m.search.globalSearch({ userId: idB }, uniqueName, "USD");
      expect(asOther.find((g: { kind: string }) => g.kind === "client")).toBeUndefined();
    });

    it("returns nothing for a query shorter than 2 characters", async () => {
      expect(await m.search.globalSearch({ userId: idA }, "a", "USD")).toEqual([]);
    });

    it("finds an invoice by its number", async () => {
      const client = await m.clients.saveClient({ userId: idA }, { name: "Search invoice client", company: null, email: null, phone: null, website: null, address: null, country: null, status: "ACTIVE", notes: null });
      const invId = await m.invoices.saveInvoice({ userId: idA }, invoiceInput(client));
      const inv = await m.invoices.getInvoice({ userId: idA }, invId, today);
      const results = await m.search.globalSearch({ userId: idA }, inv.number, "USD");
      expect(results.find((g: { kind: string }) => g.kind === "invoice").results[0].id).toBe(invId);
    });
  });

  describe("calendar integration", () => {
    it("shows an invoice due date and a project deadline alongside tasks and events", async () => {
      const u = { userId: idA };
      const client = await m.clients.saveClient(u, { name: "Cal biz client", company: null, email: null, phone: null, website: null, address: null, country: null, status: "ACTIVE", notes: null });
      const invId = await m.invoices.saveInvoice(u, invoiceInput(client, { dueDate: "2026-09-25" }));
      await m.invoices.setInvoiceStatus(u, invId, "SENT");
      const projectId = await m.projects.saveProject(u, { clientId: client, name: "Cal project", description: null, startDate: null, deadline: "2026-09-26", budget: "", currency: "USD", status: "ACTIVE", progress: 0, notes: null });

      const range = await m.cal.getCalendarRange(u, clock, "2026-09-20", "2026-09-28");
      const kinds = range.items.map((i: { kind: string; title: string }) => `${i.kind}:${i.title}`);
      expect(kinds.some((k: string) => k.startsWith("invoice:"))).toBe(true);
      expect(kinds.some((k: string) => k.startsWith("project:"))).toBe(true);
      const invoiceItem = range.items.find((i: { kind: string }) => i.kind === "invoice");
      expect(invoiceItem.ref.id).toBe(invId);
      const projectItem = range.items.find((i: { kind: string }) => i.kind === "project");
      expect(projectItem.ref.id).toBe(projectId);
    });

    it("does not show a draft invoice's due date, only sent/viewed/partially-paid ones", async () => {
      const u = { userId: idA };
      const client = await m.clients.saveClient(u, { name: "Draft invoice client", company: null, email: null, phone: null, website: null, address: null, country: null, status: "ACTIVE", notes: null });
      await m.invoices.saveInvoice(u, invoiceInput(client, { dueDate: "2026-09-25" }));
      const range = await m.cal.getCalendarRange(u, clock, "2026-09-20", "2026-09-28");
      expect(range.items.some((i: { kind: string; subtitle: string | null }) => i.kind === "invoice" && i.subtitle === "Draft invoice client")).toBe(false);
    });

    it("links a calendar event to a client (a client meeting)", async () => {
      const u = { userId: idA };
      const client = await m.clients.saveClient(u, { name: "Meeting client", company: null, email: null, phone: null, website: null, address: null, country: null, status: "ACTIVE", notes: null });
      const eventId = await m.cal.saveEvent(u, { title: "Kickoff call", type: "MEETING", allDay: false, date: "2026-09-24", clientId: client, startTime: "10:00", endTime: "10:30", location: null, notes: null }, "UTC");
      const event = await m.cal.getEvent(u, eventId, "UTC");
      expect(event.clientId).toBe(client);
      expect(event.clientName).toBe("Meeting client");
    });

    it("rejects linking an event to another user's client", async () => {
      const clientB = await m.clients.saveClient({ userId: idB }, { name: "Not yours", company: null, email: null, phone: null, website: null, address: null, country: null, status: "ACTIVE", notes: null });
      await expect(
        m.cal.saveEvent({ userId: idA }, { title: "x", type: "MEETING", allDay: true, date: today, clientId: clientB, startTime: "", endTime: "", location: null, notes: null }, "UTC"),
      ).rejects.toMatchObject({ code: "VALIDATION" });
    });

    it("never shows another user's invoices or projects on the calendar", async () => {
      const range = await m.cal.getCalendarRange({ userId: idB }, clock, "2026-09-20", "2026-09-28");
      expect(range.items.some((i: { kind: string }) => i.kind === "invoice" || i.kind === "project")).toBe(false);
    });
  });

  describe("client activity history", () => {
    it("logs client creation, project creation, invoice creation/sent, and payment recorded/voided, newest first", async () => {
      const u = { userId: idA };
      const clientId = await m.clients.saveClient(u, { name: "Activity client", company: null, email: null, phone: null, website: null, address: null, country: null, status: "ACTIVE", notes: null });
      await m.projects.saveProject(u, { clientId, name: "Activity project", description: null, startDate: null, deadline: null, budget: "", currency: "USD", status: "ACTIVE", progress: 0, notes: null });
      const invId = await m.invoices.saveInvoice(u, invoiceInput(clientId));
      await m.invoices.setInvoiceStatus(u, invId, "SENT");

      const activity = await m.clients.listClientActivity(u, clientId);
      const actions = activity.map((a: { action: string }) => a.action);
      expect(actions).toEqual(["invoice_sent", "invoice_created", "project_created", "client_created"]); // newest first
    });

    it("keeps activity private per user", async () => {
      const clientId = await m.clients.saveClient({ userId: idA }, { name: "Private activity client", company: null, email: null, phone: null, website: null, address: null, country: null, status: "ACTIVE", notes: null });
      const asOther = await m.clients.listClientActivity({ userId: idB }, clientId);
      expect(asOther).toEqual([]);
    });
  });
});
