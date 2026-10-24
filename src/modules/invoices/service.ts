import type { InvoiceStatus, Prisma } from "@/generated/prisma/client";
import type { Ctx } from "@/lib/auth/require-user";
import { parseIsoDate, toIsoDate } from "@/lib/dates";
import { forUser } from "@/lib/db/tenant";
import { AppError, notFound, validationError } from "@/lib/errors";
import { Money } from "@/lib/money";
import { getSettingsBundle } from "@/modules/settings/service";
import { calcInvoice } from "./calc";
import { logActivity } from "@/modules/shared/activity";
import { nextInvoiceNumber } from "./numbering";
import type { InvoiceInput, InvoiceListQuery } from "./schema";
import type { InvoiceDTO, InvoiceItemDTO, InvoiceListItem, InvoiceListResult } from "./types";

export const INVOICE_PAGE_SIZE = 20;
const OPEN_STATUSES: InvoiceStatus[] = ["SENT", "VIEWED", "PARTIALLY_PAID"];
const LOCKED_ONCE_PAID: InvoiceStatus[] = ["PARTIALLY_PAID", "PAID"];

const invoiceInclude = {
  client: { select: { name: true } },
  project: { select: { name: true } },
  items: { orderBy: { position: "asc" as const } },
} satisfies Prisma.InvoiceInclude;
type InvoiceRow = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

function displayStatusOf(status: InvoiceStatus, dueDate: string, today: string, balanceDue: Money): InvoiceStatus {
  if (OPEN_STATUSES.includes(status) && dueDate < today && balanceDue.isPositive()) return "OVERDUE";
  return status;
}

function bpsToPercentStr(bps: number): string {
  return (bps / 100).toString();
}

function toDTO(inv: InvoiceRow, today: string): InvoiceDTO {
  const currency = inv.currency;
  const total = Money.of(inv.totalMinor, currency);
  const paid = Money.of(inv.amountPaidMinor, currency);
  const balanceDue = total.sub(paid);
  const items: InvoiceItemDTO[] = inv.items.map((i) => ({
    id: i.id,
    description: i.description,
    quantity: i.quantity.toString(),
    rate: Money.of(i.rateMinor, currency).toDTO(),
    discountPercent: bpsToPercentStr(i.discountBps),
    taxPercent: bpsToPercentStr(i.taxBps),
    lineTotal: Money.of(i.lineTotalMinor, currency).toDTO(),
  }));
  return {
    id: inv.id,
    number: inv.number,
    clientId: inv.clientId,
    clientName: inv.client.name,
    projectId: inv.projectId,
    projectName: inv.project?.name ?? null,
    issueDate: toIsoDate(inv.issueDate),
    dueDate: toIsoDate(inv.dueDate),
    currency,
    status: inv.status,
    displayStatus: displayStatusOf(inv.status, toIsoDate(inv.dueDate), today, balanceDue),
    subtotal: Money.of(inv.subtotalMinor, currency).toDTO(),
    discount: Money.of(inv.discountMinor, currency).toDTO(),
    tax: Money.of(inv.taxMinor, currency).toDTO(),
    total: total.toDTO(),
    amountPaid: paid.toDTO(),
    balanceDue: balanceDue.toDTO(),
    notes: inv.notes,
    paymentTerms: inv.paymentTerms,
    items,
    locked: LOCKED_ONCE_PAID.includes(inv.status),
    createdAt: inv.createdAt.toISOString(),
  };
}

export async function listInvoices(ctx: Ctx, query: InvoiceListQuery, today: string): Promise<InvoiceListResult> {
  const db = forUser(ctx.userId);
  const where: Prisma.InvoiceWhereInput = {
    AND: [
      { deletedAt: null },
      query.status ? { status: query.status } : {},
      query.clientId ? { clientId: query.clientId } : {},
      query.q ? { OR: [{ number: { contains: query.q, mode: "insensitive" } }, { client: { name: { contains: query.q, mode: "insensitive" } } }] } : {},
    ],
  };
  const [total, rows, counts] = await Promise.all([
    db.invoice.count({ where }),
    db.invoice.findMany({ where, orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }], skip: (query.page - 1) * INVOICE_PAGE_SIZE, take: INVOICE_PAGE_SIZE, include: { client: { select: { name: true } } } }),
    db.invoice.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } }),
  ]);
  const statusCounts: Record<string, number> = {};
  for (const c of counts) statusCounts[c.status] = c._count._all;

  const items: InvoiceListItem[] = rows.map((r) => {
    const total_ = Money.of(r.totalMinor, r.currency);
    const paid = Money.of(r.amountPaidMinor, r.currency);
    return {
      id: r.id,
      number: r.number,
      clientId: r.clientId,
      clientName: r.client.name,
      issueDate: toIsoDate(r.issueDate),
      dueDate: toIsoDate(r.dueDate),
      total: total_.toDTO(),
      amountPaid: paid.toDTO(),
      status: r.status,
      displayStatus: displayStatusOf(r.status, toIsoDate(r.dueDate), today, total_.sub(paid)),
    };
  });
  return { items, total, page: query.page, pageSize: INVOICE_PAGE_SIZE, statusCounts };
}

export async function listInvoicesForClient(ctx: Ctx, clientId: string, today: string): Promise<InvoiceListItem[]> {
  const res = await listInvoices(ctx, { clientId, page: 1 }, today);
  return res.items;
}

export async function getInvoice(ctx: Ctx, id: string, today: string): Promise<InvoiceDTO | null> {
  const row = await forUser(ctx.userId).invoice.findFirst({ where: { id, deletedAt: null }, include: invoiceInclude });
  return row ? toDTO(row, today) : null;
}

export async function saveInvoice(ctx: Ctx, input: InvoiceInput): Promise<string> {
  const db = forUser(ctx.userId);
  const client = await db.client.findFirst({ where: { id: input.clientId, deletedAt: null }, select: { id: true } });
  if (!client) throw validationError("Choose a client.", { clientId: ["That client no longer exists."] });
  if (input.projectId) {
    const project = await db.project.findFirst({ where: { id: input.projectId, deletedAt: null, clientId: input.clientId }, select: { id: true } });
    if (!project) throw validationError("Choose a project that belongs to this client.", { projectId: ["Choose a project that belongs to this client."] });
  }

  const calc = calcInvoice(input.items, input.currency);
  const fields = {
    clientId: input.clientId,
    projectId: input.projectId,
    issueDate: parseIsoDate(input.issueDate),
    dueDate: parseIsoDate(input.dueDate),
    currency: input.currency,
    notes: input.notes,
    paymentTerms: input.paymentTerms,
    subtotalMinor: calc.subtotalMinor,
    discountMinor: calc.discountMinor,
    taxMinor: calc.taxMinor,
    totalMinor: calc.totalMinor,
  };

  return db.$transaction(async (tx) => {
    let id: string;
    if (input.id) {
      const existing = await tx.invoice.findFirst({ where: { id: input.id, deletedAt: null } });
      if (!existing) throw notFound("Invoice");
      if (LOCKED_ONCE_PAID.includes(existing.status)) {
        throw new AppError("FORBIDDEN", "This invoice has payments recorded against it, so its line items are locked. Cancel it and issue a new one instead.");
      }
      id = existing.id;
      await tx.invoice.update({ where: { id }, data: fields });
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
    } else {
      const { settings } = await getSettingsBundle(ctx);
      const year = Number(input.issueDate.slice(0, 4));
      const number = await nextInvoiceNumber(ctx.userId, settings, year);
      const created = await tx.invoice.create({ data: { userId: ctx.userId, number, status: "DRAFT", amountPaidMinor: 0n, ...fields } });
      id = created.id;
      await logActivity(tx, ctx.userId, "client", input.clientId, "invoice_created", { number: created.number, total: calc.totalMinor.toString(), currency: input.currency });
    }
    await tx.invoiceItem.createMany({
      data: calc.lines.map((l, position) => ({ invoiceId: id, description: l.description, quantity: l.quantity, rateMinor: l.rateMinor, discountBps: l.discountBps, taxBps: l.taxBps, lineTotalMinor: l.lineTotalMinor, position })),
    });
    return id;
  });
}

const SENDABLE_FROM: InvoiceStatus[] = ["DRAFT"];

export async function setInvoiceStatus(ctx: Ctx, id: string, status: "SENT" | "VIEWED" | "CANCELLED"): Promise<void> {
  const db = forUser(ctx.userId);
  const invoice = await db.invoice.findFirst({ where: { id, deletedAt: null } });
  if (!invoice) throw notFound("Invoice");
  if (status === "SENT" && !SENDABLE_FROM.includes(invoice.status)) throw new AppError("FORBIDDEN", "Only a draft invoice can be marked as sent.");
  if (status === "CANCELLED" && LOCKED_ONCE_PAID.includes(invoice.status)) throw new AppError("FORBIDDEN", "This invoice has payments recorded, so it can't be cancelled.");
  await db.invoice.update({ where: { id }, data: { status, ...(status === "SENT" ? { sentAt: new Date() } : {}), ...(status === "VIEWED" && !invoice.viewedAt ? { viewedAt: new Date() } : {}) } });
  if (status === "SENT") await logActivity(db, ctx.userId, "client", invoice.clientId, "invoice_sent", { number: invoice.number });
}

export async function deleteInvoice(ctx: Ctx, id: string): Promise<void> {
  const db = forUser(ctx.userId);
  const invoice = await db.invoice.findFirst({ where: { id, deletedAt: null } });
  if (!invoice) throw notFound("Invoice");
  if (invoice.status !== "DRAFT") throw new AppError("FORBIDDEN", "Only a draft invoice can be deleted. Cancel it instead.");
  await db.invoice.update({ where: { id }, data: { deletedAt: new Date() } });
}
