/**
 * Loans (ধার / কর্জে হাসানা), donations (দান) and inline categories against a real Postgres.
 * The risk is the same as Phase 3: account balances must always equal the ledger, so every flow
 * that moves money is checked against reconcileAccount().
 *   TEST_DATABASE_URL=postgresql://… npm test
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d("loans & donations (real database)", () => {
  let idA = "";
  let idB = "";
  const stamp = Date.now();
  const emails = [`p7a-${stamp}@test.local`, `p7b-${stamp}@test.local`];
  const today = "2026-10-22";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let m: any;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.REGISTRATION_MODE = "open";
    m = {
      prisma: (await import("@/lib/db/client")).prisma,
      auth: await import("@/modules/auth/service"),
      finance: await import("@/modules/finance/service"),
      loans: await import("@/modules/loans/service"),
      donations: await import("@/modules/donations/service"),
      dashboard: await import("@/modules/dashboard/service"),
      settings: await import("@/modules/settings/service"),
      schemas: {
        loan: (await import("@/modules/loans/schema")).loanInputSchema,
        repayment: (await import("@/modules/loans/schema")).repaymentInputSchema,
        donation: (await import("@/modules/donations/schema")).donationInputSchema,
      },
    };
    const reg = (email: string, ip: string) =>
      m.auth.registerUser({ name: "T", email, password: "correct horse battery", confirmPassword: "correct horse battery", baseCurrency: "BDT", timezone: "Asia/Dhaka" }, ip);
    idA = await reg(emails[0]!, `10.9.${stamp % 250}.1`);
    idB = await reg(emails[1]!, `10.9.${stamp % 250}.2`);
  });

  afterAll(async () => {
    await m.prisma.user.deleteMany({ where: { email: { in: emails } } });
  });

  const bal = async (accountId: string) => (await m.prisma.account.findUniqueOrThrow({ where: { id: accountId } })).currentBalanceMinor as bigint;
  /** The cached balance must equal opening balance + every live ledger leg. */
  const expectReconciled = async (u: { userId: string }, accountId: string) => {
    const before = await bal(accountId);
    const after = await m.finance.reconcileAccount(u, accountId);
    expect(BigInt(after.balance.minor)).toBe(before);
  };
  const loanInput = (over: Record<string, unknown> = {}) =>
    m.schemas.loan.parse({ direction: "LENT", kind: "STANDARD", personName: "Karim", personPhone: "", amount: "5000", currency: "BDT", date: "2026-10-01", dueDate: "", accountId: "", notes: "", ...over });
  const repay = (loanId: string, amount: string, accountId = "") => m.schemas.repayment.parse({ loanId, amount, date: "2026-10-10", accountId, notes: "" });
  const donationInput = (over: Record<string, unknown> = {}) =>
    m.schemas.donation.parse({ recipient: "Mosque", categoryId: "", amount: "1000", currency: "BDT", date: "2026-10-05", accountId: "", notes: "", ...over });

  describe("loans", () => {
    it("lending from an account lowers its balance; repayments bring it back; status follows", async () => {
      const u = { userId: idA };
      const acc = await m.finance.saveAccount(u, { name: "bKash", type: "WALLET", currency: "BDT", openingBalance: "10000", isSavings: false });
      const id = await m.loans.saveLoan(u, loanInput({ accountId: acc }));
      expect(await bal(acc)).toBe(500000n); // 10,000 − 5,000 BDT
      await expectReconciled(u, acc);

      await m.loans.addRepayment(u, repay(id, "2000", acc));
      let loan = await m.loans.getLoan(u, id, today);
      expect(loan.status).toBe("PARTIAL");
      expect(loan.outstanding).toEqual({ minor: "300000", currency: "BDT" });
      expect(await bal(acc)).toBe(700000n);

      await m.loans.addRepayment(u, repay(id, "3000", acc));
      loan = await m.loans.getLoan(u, id, today);
      expect(loan.status).toBe("SETTLED");
      expect(await bal(acc)).toBe(1000000n);
      await expectReconciled(u, acc);
    });

    it("borrowing into an account raises it; repaying lowers it", async () => {
      const u = { userId: idA };
      const acc = await m.finance.saveAccount(u, { name: "City Bank", type: "BANK", currency: "BDT", openingBalance: "0", isSavings: false });
      const id = await m.loans.saveLoan(u, loanInput({ direction: "BORROWED", kind: "QARD_HASAN", personName: "Rahim", amount: "20000", accountId: acc }));
      expect(await bal(acc)).toBe(2000000n);
      await m.loans.addRepayment(u, repay(id, "5000", acc));
      expect(await bal(acc)).toBe(1500000n);
      await expectReconciled(u, acc);
      const totals = await m.loans.getLoanTotals(u, today);
      expect(totals.qardHasanPayable).toEqual([{ minor: "1500000", currency: "BDT" }]);
    });

    it("loan legs never count as income or expense", async () => {
      const u = { userId: idA };
      const list = await m.finance.listTransactions(u, { page: 1 });
      expect(list.items.every((t: { type: string }) => t.type === "INCOME" || t.type === "EXPENSE")).toBe(true);
      expect(list.items.length).toBe(0);
    });

    it("rejects an overpayment and a currency/account mismatch", async () => {
      const u = { userId: idA };
      const gbp = await m.finance.saveAccount(u, { name: "Monzo", type: "BANK", currency: "GBP", openingBalance: "100", isSavings: false });
      const id = await m.loans.saveLoan(u, loanInput({ amount: "100" }));
      await expect(m.loans.addRepayment(u, repay(id, "150"))).rejects.toMatchObject({ code: "VALIDATION" });
      await expect(m.loans.addRepayment(u, repay(id, "50", gbp))).rejects.toMatchObject({ code: "VALIDATION" });
      await expect(m.loans.saveLoan(u, loanInput({ accountId: gbp }))).rejects.toMatchObject({ code: "VALIDATION" });
      // A GBP loan can use the GBP account.
      await m.loans.saveLoan(u, loanInput({ currency: "GBP", amount: "40", accountId: gbp }));
      expect(await bal(gbp)).toBe(6000n);
    });

    it("concurrent repayments can't overpay together", async () => {
      const u = { userId: idA };
      const id = await m.loans.saveLoan(u, loanInput({ amount: "100" }));
      const results = await Promise.allSettled([m.loans.addRepayment(u, repay(id, "60")), m.loans.addRepayment(u, repay(id, "60"))]);
      const loan = await m.loans.getLoan(u, id, today);
      expect(BigInt(loan.repaid.minor)).toBeLessThanOrEqual(10000n);
      expect(results.some((r) => r.status === "fulfilled")).toBe(true);
    });

    it("editing moves the money between accounts, then locks once repaid", async () => {
      const u = { userId: idA };
      const a1 = await m.finance.saveAccount(u, { name: "Cash 1", type: "CASH", currency: "BDT", openingBalance: "1000", isSavings: false });
      const a2 = await m.finance.saveAccount(u, { name: "Cash 2", type: "CASH", currency: "BDT", openingBalance: "1000", isSavings: false });
      const id = await m.loans.saveLoan(u, loanInput({ amount: "300", accountId: a1 }));
      await m.loans.saveLoan(u, loanInput({ id, amount: "400", accountId: a2 }));
      expect(await bal(a1)).toBe(100000n);
      expect(await bal(a2)).toBe(60000n);
      await m.loans.saveLoan(u, loanInput({ id, amount: "400", accountId: "" }));
      expect(await bal(a2)).toBe(100000n);
      await expectReconciled(u, a1);
      await expectReconciled(u, a2);

      await m.loans.addRepayment(u, repay(id, "100"));
      await expect(m.loans.saveLoan(u, loanInput({ id, amount: "500" }))).rejects.toMatchObject({ code: "CONFLICT" });
      await m.loans.saveLoan(u, loanInput({ id, amount: "400", personName: "Karim bhai", notes: "renamed" })); // non-money edits still work
      expect((await m.loans.getLoan(u, id, today)).personName).toBe("Karim bhai");
    });

    it("deleting a loan restores every account it touched", async () => {
      const u = { userId: idA };
      const acc = await m.finance.saveAccount(u, { name: "Del acc", type: "CASH", currency: "BDT", openingBalance: "1000", isSavings: false });
      const id = await m.loans.saveLoan(u, loanInput({ amount: "600", accountId: acc }));
      await m.loans.addRepayment(u, repay(id, "200", acc));
      await m.loans.deleteLoan(u, id);
      expect(await bal(acc)).toBe(100000n);
      await expectReconciled(u, acc);
      expect(await m.loans.getLoan(u, id, today)).toBeNull();
    });

    it("forgiving logs a donation without moving money, and can be undone", async () => {
      const u = { userId: idA };
      const cats = await m.settings.listCategoriesOfType(u, "DONATION");
      const sadaqah = cats.find((c: { name: string }) => c.name.startsWith("Sadaqah"));
      expect(sadaqah).toBeTruthy();
      const id = await m.loans.saveLoan(u, loanInput({ kind: "QARD_HASAN", amount: "1000" }));
      await m.loans.addRepayment(u, repay(id, "400"));
      await m.loans.forgiveLoan(u, { loanId: id, recordAsDonation: true, donationCategoryId: sadaqah.id }, today);
      let loan = await m.loans.getLoan(u, id, today);
      expect(loan.status).toBe("FORGIVEN");
      expect(loan.outstanding.minor).toBe("0");
      const gifts = await m.donations.listDonations(u, { year: 2026 }, today);
      const fromLoan = gifts.find((g: { loanId: string | null }) => g.loanId === id);
      expect(fromLoan.amount).toEqual({ minor: "60000", currency: "BDT" });
      await expect(m.donations.deleteDonation(u, fromLoan.id)).rejects.toMatchObject({ code: "CONFLICT" });

      await m.loans.unforgiveLoan(u, id);
      loan = await m.loans.getLoan(u, id, today);
      expect(loan.status).toBe("PARTIAL");
      expect((await m.donations.listDonations(u, { year: 2026 }, today)).some((g: { loanId: string | null }) => g.loanId === id)).toBe(false);
    });

    it("another user can't see or touch a loan", async () => {
      const id = await m.loans.saveLoan({ userId: idA }, loanInput());
      expect(await m.loans.getLoan({ userId: idB }, id, today)).toBeNull();
      await expect(m.loans.addRepayment({ userId: idB }, repay(id, "1"))).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(m.loans.deleteLoan({ userId: idB }, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("donations", () => {
    it("paid from an account books an expense under 'Donations' and keeps the balance exact", async () => {
      const u = { userId: idB };
      const acc = await m.finance.saveAccount(u, { name: "Wallet", type: "WALLET", currency: "BDT", openingBalance: "5000", isSavings: false });
      const zakat = (await m.settings.listCategoriesOfType(u, "DONATION")).find((c: { name: string }) => c.name.startsWith("Zakat"));
      const id = await m.donations.saveDonation(u, donationInput({ categoryId: zakat.id, accountId: acc }));
      expect(await bal(acc)).toBe(400000n);
      const txns = await m.finance.listTransactions(u, { page: 1 });
      const leg = txns.items.find((t: { donationId: string | null }) => t.donationId === id);
      expect(leg.type).toBe("EXPENSE");
      expect(leg.categoryName).toBe("Donations");
      // The finance screens must not edit or delete it behind the donation's back.
      await expect(m.finance.deleteTransaction(u, leg.id)).rejects.toMatchObject({ code: "FORBIDDEN" });

      await m.donations.saveDonation(u, donationInput({ id, categoryId: zakat.id, amount: "1500", accountId: acc }));
      expect(await bal(acc)).toBe(350000n);
      await m.donations.saveDonation(u, donationInput({ id, categoryId: zakat.id, amount: "1500", accountId: "" }));
      expect(await bal(acc)).toBe(500000n);
      await expectReconciled(u, acc);

      const summary = await m.donations.getDonationSummary(u, today);
      expect(summary.thisYear).toEqual([{ minor: "150000", currency: "BDT" }]);
      expect(summary.byCategory[0].categoryName).toBe(zakat.name);

      await m.donations.deleteDonation(u, id);
      expect((await m.donations.getDonationSummary(u, today)).allTime).toEqual([]);
    });

    it("keeps totals per currency instead of mixing BDT, GBP and EUR", async () => {
      const u = { userId: idB };
      await m.donations.saveDonation(u, donationInput({ amount: "500" }));
      await m.donations.saveDonation(u, donationInput({ amount: "20", currency: "GBP" }));
      await m.donations.saveDonation(u, donationInput({ amount: "15.50", currency: "EUR" }));
      const s = await m.donations.getDonationSummary(u, today);
      expect(s.thisMonth).toEqual([
        { minor: "50000", currency: "BDT" },
        { minor: "2000", currency: "GBP" },
        { minor: "1550", currency: "EUR" },
      ]);
    });

    it("refuses another user's category", async () => {
      const otherCat = (await m.settings.listCategoriesOfType({ userId: idA }, "DONATION"))[0];
      await expect(m.donations.saveDonation({ userId: idB }, donationInput({ categoryId: otherCat.id }))).rejects.toMatchObject({ code: "VALIDATION" });
    });
  });

  describe("categories", () => {
    it("creating a category returns it so a form can select it immediately", async () => {
      const c = await m.settings.createCategory({ userId: idB }, { type: "DONATION", name: `Orphans-${stamp}`, color: "#0e6b5c" });
      expect(c.id).toBeTruthy();
      const list = await m.settings.listCategoriesOfType({ userId: idB }, "DONATION");
      expect(list.some((x: { id: string }) => x.id === c.id)).toBe(true);
    });
  });
});
