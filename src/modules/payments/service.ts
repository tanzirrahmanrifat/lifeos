import type { Prisma } from "@/generated/prisma/client";
import type { Ctx } from "@/lib/auth/require-user";
import { parseIsoDate, toIsoDate } from "@/lib/dates";
import { forUser } from "@/lib/db/tenant";
import { AppError, notFound, validationError } from "@/lib/errors";
import { Money } from "@/lib/money";
import { requirePositiveMoney } from "@/modules/finance/money-input";
import { logActivity } from "@/modules/shared/activity";
import type { PaymentInput } from "./schema";
import type { PaymentDTO, PaymentListResult } from "./types";

export const PAYMENT_PAGE_SIZE = 25;

const paymentInclude = {
  invoice: { select: { number: true } },
  client: { select: { name: true } },
  account: { select: { name: true } },
} satisfies Prisma.PaymentInclude;
type PaymentRow = Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>;

function toDTO(p: PaymentRow): PaymentDTO {
  return {
    id: p.id,
    invoiceId: p.invoiceId,
    invoiceNumber: p.invoice.number,
    clientId: p.clientId,
    clientName: p.client.name,
    accountId: p.accountId,
    accountName: p.account.name,
    amount: Money.of(p.amountMinor, p.currency).toDTO(),
    date: toIsoDate(p.date),
    method: p.method,
    reference: p.reference,
    notes: p.notes,
    voided: p.voidedAt !== null,
  };
}

export async function listPayments(ctx: Ctx, page: number): Promise<PaymentListResult> {
  const db = forUser(ctx.userId);
  const where: Prisma.PaymentWhereInput = { voidedAt: null };
  const [total, rows] = await Promise.all([
    db.payment.count({ where }),
    db.payment.findMany({ where, orderBy: [{ date: "desc" }, { createdAt: "desc" }], skip: (page - 1) * PAYMENT_PAGE_SIZE, take: PAYMENT_PAGE_SIZE, include: paymentInclude }),
  ]);
  return { items: rows.map(toDTO), total, page, pageSize: PAYMENT_PAGE_SIZE };
}

export async function listPaymentsForInvoice(ctx: Ctx, invoiceId: string): Promise<PaymentDTO[]> {
  const rows = await forUser(ctx.userId).payment.findMany({ where: { invoiceId }, orderBy: { date: "desc" }, include: paymentInclude });
  return rows.map(toDTO);
}

/**
 * The core Phase 4 automation, all in one database transaction:
 *   record payment → update invoice paid amount + status → create the matching income
 *   transaction (categorised "Client payment") → update the account balance → the client's
 *   revenue and the dashboard both fall out of this automatically, since they're computed by
 *   summing payments/transactions rather than storing a duplicate total anywhere.
 * A partial payment cannot exceed the invoice's remaining balance.
 */
export async function recordPayment(ctx: Ctx, input: PaymentInput): Promise<string> {
  const db = forUser(ctx.userId);

  return db.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({ where: { id: input.invoiceId, deletedAt: null } });
    if (!invoice) throw notFound("Invoice");
    if (invoice.status === "DRAFT") throw new AppError("FORBIDDEN", "Send the invoice before recording a payment against it.");
    if (invoice.status === "CANCELLED") throw new AppError("FORBIDDEN", "This invoice is cancelled.");
    if (invoice.status === "PAID") throw new AppError("FORBIDDEN", "This invoice is already fully paid.");

    const account = await tx.account.findFirst({ where: { id: input.accountId, deletedAt: null, archivedAt: null } });
    if (!account) throw validationError("Choose an account.", { accountId: ["That account no longer exists or is archived."] });
    if (account.currency !== invoice.currency) throw validationError(`Choose a ${invoice.currency} account, to match this invoice's currency.`, { accountId: [`Choose a ${invoice.currency} account.`] });

    const amount = requirePositiveMoney(input.amount, invoice.currency, "amount");
    const balanceDue = invoice.totalMinor - invoice.amountPaidMinor;
    if (amount.minor > balanceDue) {
      throw validationError(`That's more than the remaining balance of ${Money.of(balanceDue, invoice.currency).toMajorString()}.`, { amount: ["That's more than the remaining balance."] });
    }

    const category = await tx.category.findFirst({ where: { type: "INCOME", isSystem: true, name: "Client payment" }, select: { id: true } });

    const payment = await tx.payment.create({
      data: { userId: ctx.userId, invoiceId: invoice.id, clientId: invoice.clientId, accountId: account.id, amountMinor: amount.minor, currency: invoice.currency, date: parseIsoDate(input.date), method: input.method, reference: input.reference, notes: input.notes },
    });

    await tx.transaction.create({
      data: {
        userId: ctx.userId,
        accountId: account.id,
        type: "INCOME",
        amountMinor: amount.minor,
        currency: invoice.currency,
        date: parseIsoDate(input.date),
        categoryId: category?.id ?? null,
        clientId: invoice.clientId,
        projectId: invoice.projectId,
        paymentId: payment.id,
        notes: `Payment for invoice ${invoice.number}`,
      },
    });

    await tx.account.update({ where: { id: account.id }, data: { currentBalanceMinor: { increment: amount.minor } } });

    const newPaid = invoice.amountPaidMinor + amount.minor;
    const newStatus = newPaid >= invoice.totalMinor ? "PAID" : "PARTIALLY_PAID";
    await tx.invoice.update({ where: { id: invoice.id }, data: { amountPaidMinor: newPaid, status: newStatus } });
    await logActivity(tx, ctx.userId, "client", invoice.clientId, "payment_recorded", { invoiceNumber: invoice.number, amount: amount.minor.toString(), currency: invoice.currency });

    return payment.id;
  });
}

/** Reverses a payment: deletes it, its income transaction, the account balance effect, and reopens the invoice. */
export async function voidPayment(ctx: Ctx, id: string): Promise<void> {
  const db = forUser(ctx.userId);
  await db.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({ where: { id, voidedAt: null } });
    if (!payment) throw notFound("Payment");

    await tx.transaction.updateMany({ where: { paymentId: payment.id }, data: { deletedAt: new Date() } });
    await tx.account.update({ where: { id: payment.accountId }, data: { currentBalanceMinor: { decrement: payment.amountMinor } } });
    await tx.payment.update({ where: { id: payment.id }, data: { voidedAt: new Date() } });

    const invoice = await tx.invoice.findFirstOrThrow({ where: { id: payment.invoiceId } });
    const newPaid = invoice.amountPaidMinor - payment.amountMinor;
    const newStatus = newPaid <= 0n ? "SENT" : "PARTIALLY_PAID";
    await tx.invoice.update({ where: { id: invoice.id }, data: { amountPaidMinor: newPaid < 0n ? 0n : newPaid, status: newStatus } });
    await logActivity(tx, ctx.userId, "client", invoice.clientId, "payment_voided", { invoiceNumber: invoice.number, amount: payment.amountMinor.toString(), currency: invoice.currency });
  });
}
