import type { Prisma } from "@/generated/prisma/client";
import type { Ctx } from "@/lib/auth/require-user";
import { forUser } from "@/lib/db/tenant";
import { notFound } from "@/lib/errors";
import { Money } from "@/lib/money";
import { logActivity } from "@/modules/shared/activity";
import type { ClientInput, ClientListQuery } from "./schema";
import type { ClientDetail, ClientDTO, ClientListResult } from "./types";

export const CLIENT_PAGE_SIZE = 24;
const OPEN_INVOICE_STATUSES = ["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"] as const;

function toBase(c: { id: string; name: string; company: string | null; email: string | null; phone: string | null; website: string | null; address: string | null; country: string | null; status: string; notes: string | null; createdAt: Date }): ClientDTO {
  return {
    id: c.id,
    name: c.name,
    company: c.company,
    email: c.email,
    phone: c.phone,
    website: c.website,
    address: c.address,
    country: c.country,
    status: c.status as ClientDTO["status"],
    notes: c.notes,
    createdAt: c.createdAt.toISOString(),
  };
}

export async function listClients(ctx: Ctx, query: ClientListQuery, currency: string): Promise<ClientListResult> {
  const db = forUser(ctx.userId);
  const where: Prisma.ClientWhereInput = {
    AND: [
      { deletedAt: null },
      query.status ? { status: query.status } : {},
      query.q
        ? { OR: [{ name: { contains: query.q, mode: "insensitive" } }, { company: { contains: query.q, mode: "insensitive" } }, { email: { contains: query.q, mode: "insensitive" } }] }
        : {},
    ],
  };
  const [total, rows] = await Promise.all([
    db.client.count({ where }),
    db.client.findMany({ where, orderBy: [{ name: "asc" }], skip: (query.page - 1) * CLIENT_PAGE_SIZE, take: CLIENT_PAGE_SIZE }),
  ]);
  if (rows.length === 0) return { items: [], total, page: query.page, pageSize: CLIENT_PAGE_SIZE };

  const ids = rows.map((r) => r.id);
  const [paymentSums, invoiceSums, projectCounts, openCounts] = await Promise.all([
    db.payment.groupBy({ by: ["clientId"], where: { clientId: { in: ids }, voidedAt: null, currency }, _sum: { amountMinor: true } }),
    db.invoice.groupBy({ by: ["clientId"], where: { clientId: { in: ids }, deletedAt: null, currency, status: { in: [...OPEN_INVOICE_STATUSES] } }, _sum: { totalMinor: true, amountPaidMinor: true } }),
    db.project.groupBy({ by: ["clientId"], where: { clientId: { in: ids }, deletedAt: null }, _count: { _all: true } }),
    db.invoice.groupBy({ by: ["clientId"], where: { clientId: { in: ids }, deletedAt: null, status: { in: [...OPEN_INVOICE_STATUSES] } }, _count: { _all: true } }),
  ]);
  const revenueBy = new Map(paymentSums.map((s) => [s.clientId, s._sum.amountMinor ?? 0n]));
  const outstandingBy = new Map(invoiceSums.map((s) => [s.clientId, (s._sum.totalMinor ?? 0n) - (s._sum.amountPaidMinor ?? 0n)]));
  const projectsBy = new Map(projectCounts.map((p) => [p.clientId, p._count._all]));
  const openBy = new Map(openCounts.map((p) => [p.clientId, p._count._all]));

  return {
    items: rows.map((r) => ({
      ...toBase(r),
      totalRevenue: Money.of(revenueBy.get(r.id) ?? 0n, currency).toDTO(),
      outstanding: Money.of(outstandingBy.get(r.id) ?? 0n, currency).toDTO(),
      projectCount: projectsBy.get(r.id) ?? 0,
      openInvoiceCount: openBy.get(r.id) ?? 0,
    })),
    total,
    page: query.page,
    pageSize: CLIENT_PAGE_SIZE,
  };
}

export async function getClient(ctx: Ctx, id: string, currency: string): Promise<ClientDetail | null> {
  const db = forUser(ctx.userId);
  const row = await db.client.findFirst({ where: { id, deletedAt: null } });
  if (!row) return null;
  const [revenue, invoices] = await Promise.all([
    db.payment.aggregate({ where: { clientId: id, voidedAt: null, currency }, _sum: { amountMinor: true } }),
    db.invoice.aggregate({ where: { clientId: id, deletedAt: null, currency, status: { in: [...OPEN_INVOICE_STATUSES] } }, _sum: { totalMinor: true, amountPaidMinor: true } }),
  ]);
  return {
    ...toBase(row),
    totalRevenue: Money.of(revenue._sum.amountMinor ?? 0n, currency).toDTO(),
    outstanding: Money.of((invoices._sum.totalMinor ?? 0n) - (invoices._sum.amountPaidMinor ?? 0n), currency).toDTO(),
  };
}

export async function listClientOptions(ctx: Ctx): Promise<{ id: string; name: string }[]> {
  const rows = await forUser(ctx.userId).client.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return rows;
}

export async function saveClient(ctx: Ctx, input: ClientInput): Promise<string> {
  const db = forUser(ctx.userId);
  const fields = { name: input.name, company: input.company, email: input.email, phone: input.phone, website: input.website, address: input.address, country: input.country, status: input.status, notes: input.notes };
  if (input.id) {
    const { count } = await db.client.updateMany({ where: { id: input.id, deletedAt: null }, data: fields });
    if (count === 0) throw notFound("Client");
    return input.id;
  }
  const created = await db.client.create({ data: { userId: ctx.userId, ...fields } });
  await logActivity(db, ctx.userId, "client", created.id, "client_created", { name: created.name });
  return created.id;
}

export async function deleteClient(ctx: Ctx, id: string): Promise<void> {
  const { count } = await forUser(ctx.userId).client.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
  if (count === 0) throw notFound("Client");
}

export interface ActivityEntry {
  id: string;
  action: string;
  meta: Record<string, unknown> | null;
  at: string;
}

export async function listClientActivity(ctx: Ctx, clientId: string, take = 20): Promise<ActivityEntry[]> {
  const rows = await forUser(ctx.userId).activityLog.findMany({ where: { entityType: "client", entityId: clientId }, orderBy: { at: "desc" }, take });
  return rows.map((r) => ({ id: r.id, action: r.action, meta: (r.meta as Record<string, unknown> | null) ?? null, at: r.at.toISOString() }));
}
