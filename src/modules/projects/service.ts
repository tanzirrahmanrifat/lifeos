import type { Prisma } from "@/generated/prisma/client";
import type { ProjectStatus } from "@/generated/prisma/enums";
import type { Ctx } from "@/lib/auth/require-user";
import { parseIsoDate, toIsoDateOrNull } from "@/lib/dates";
import { forUser } from "@/lib/db/tenant";
import { notFound, validationError } from "@/lib/errors";
import { Money } from "@/lib/money";
import { requireMoney } from "@/modules/finance/money-input";
import { logActivity } from "@/modules/shared/activity";
import type { ProjectInput, ProjectListQuery } from "./schema";
import type { ProjectDTO, ProjectListResult } from "./types";

export const PROJECT_PAGE_SIZE = 24;
const OPEN_TASK_STATUSES = ["TODO", "IN_PROGRESS"] as const;

async function decorate(ctx: Ctx, rows: { id: string; name: string; description: string | null; clientId: string; client: { name: string }; startDate: Date | null; deadline: Date | null; budgetMinor: bigint | null; currency: string; status: ProjectStatus; progress: number; notes: string | null }[], today: string): Promise<ProjectDTO[]> {
  if (rows.length === 0) return [];
  const db = forUser(ctx.userId);
  const ids = rows.map((r) => r.id);
  const [expenseSums, taskCounts, openCounts] = await Promise.all([
    db.transaction.groupBy({ by: ["projectId"], where: { projectId: { in: ids }, type: "EXPENSE", deletedAt: null }, _sum: { amountMinor: true } }),
    db.task.groupBy({ by: ["projectId"], where: { projectId: { in: ids }, deletedAt: null }, _count: { _all: true } }),
    db.task.groupBy({ by: ["projectId"], where: { projectId: { in: ids }, deletedAt: null, status: { in: [...OPEN_TASK_STATUSES] } }, _count: { _all: true } }),
  ]);
  // Revenue per project = sum of payments on invoices that belong to that project.
  const invoicesByProject = await db.invoice.findMany({ where: { projectId: { in: ids }, deletedAt: null }, select: { id: true, projectId: true } });
  const projectByInvoice = new Map(invoicesByProject.map((i) => [i.id, i.projectId as string]));
  const paymentRows = await db.payment.findMany({ where: { voidedAt: null, invoiceId: { in: [...projectByInvoice.keys()] } }, select: { invoiceId: true, amountMinor: true } });
  const revenueByProject = new Map<string, bigint>();
  for (const p of paymentRows) {
    const pid = projectByInvoice.get(p.invoiceId);
    if (!pid) continue;
    revenueByProject.set(pid, (revenueByProject.get(pid) ?? 0n) + p.amountMinor);
  }
  const expenseBy = new Map(expenseSums.map((s) => [s.projectId, s._sum.amountMinor ?? 0n]));
  const taskBy = new Map(taskCounts.map((t) => [t.projectId, t._count._all]));
  const openBy = new Map(openCounts.map((t) => [t.projectId, t._count._all]));

  return rows.map((r) => {
    const currency = r.currency;
    const deadline = toIsoDateOrNull(r.deadline);
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      clientId: r.clientId,
      clientName: r.client.name,
      startDate: toIsoDateOrNull(r.startDate),
      deadline,
      budget: r.budgetMinor !== null ? Money.of(r.budgetMinor, currency).toDTO() : null,
      status: r.status,
      progress: r.progress,
      notes: r.notes,
      revenue: Money.of(revenueByProject.get(r.id) ?? 0n, currency).toDTO(),
      expenses: Money.of(expenseBy.get(r.id) ?? 0n, currency).toDTO(),
      taskCount: taskBy.get(r.id) ?? 0,
      openTaskCount: openBy.get(r.id) ?? 0,
      overdue: deadline !== null && deadline < today && r.status !== "COMPLETED" && r.status !== "CANCELLED",
    };
  });
}

const projectInclude = { client: { select: { name: true } } } satisfies Prisma.ProjectInclude;

export async function listProjects(ctx: Ctx, query: ProjectListQuery, today: string): Promise<ProjectListResult> {
  const db = forUser(ctx.userId);
  const where: Prisma.ProjectWhereInput = {
    AND: [
      { deletedAt: null },
      query.status ? { status: query.status } : {},
      query.clientId ? { clientId: query.clientId } : {},
      query.q ? { name: { contains: query.q, mode: "insensitive" } } : {},
    ],
  };
  const [total, rows] = await Promise.all([
    db.project.count({ where }),
    db.project.findMany({ where, orderBy: [{ deadline: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }], skip: (query.page - 1) * PROJECT_PAGE_SIZE, take: PROJECT_PAGE_SIZE, include: projectInclude }),
  ]);
  return { items: await decorate(ctx, rows, today), total, page: query.page, pageSize: PROJECT_PAGE_SIZE };
}

export async function listProjectsForClient(ctx: Ctx, clientId: string, today: string): Promise<ProjectDTO[]> {
  const rows = await forUser(ctx.userId).project.findMany({ where: { clientId, deletedAt: null }, orderBy: [{ createdAt: "desc" }], include: projectInclude });
  return decorate(ctx, rows, today);
}

export async function getProject(ctx: Ctx, id: string, today: string): Promise<ProjectDTO | null> {
  const row = await forUser(ctx.userId).project.findFirst({ where: { id, deletedAt: null }, include: projectInclude });
  if (!row) return null;
  return (await decorate(ctx, [row], today))[0] ?? null;
}

export async function listProjectOptions(ctx: Ctx, clientId?: string): Promise<{ id: string; name: string }[]> {
  return forUser(ctx.userId).project.findMany({ where: { deletedAt: null, ...(clientId ? { clientId } : {}) }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}

export async function saveProject(ctx: Ctx, input: ProjectInput): Promise<string> {
  const db = forUser(ctx.userId);
  const client = await db.client.findFirst({ where: { id: input.clientId, deletedAt: null }, select: { id: true } });
  if (!client) throw validationError("Choose a client.", { clientId: ["That client no longer exists."] });
  const budget = input.budget?.trim() ? requireMoney(input.budget, input.currency, "budget") : null;
  const fields = { clientId: input.clientId, name: input.name, description: input.description, startDate: input.startDate ? parseIsoDate(input.startDate) : null, deadline: input.deadline ? parseIsoDate(input.deadline) : null, budgetMinor: budget?.minor ?? null, currency: input.currency, status: input.status, progress: input.progress, notes: input.notes };

  if (input.id) {
    const { count } = await db.project.updateMany({ where: { id: input.id, deletedAt: null }, data: fields });
    if (count === 0) throw notFound("Project");
    return input.id;
  }
  const created = await db.project.create({ data: { userId: ctx.userId, ...fields } });
  await logActivity(db, ctx.userId, "client", input.clientId, "project_created", { name: created.name });
  return created.id;
}

export async function deleteProject(ctx: Ctx, id: string): Promise<void> {
  const db = forUser(ctx.userId);
  const linkedInvoices = await db.invoice.count({ where: { projectId: id, deletedAt: null } });
  if (linkedInvoices > 0) throw validationError("This project has invoices. Remove or reassign them first, or cancel the project instead of deleting it.");
  const { count } = await db.project.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
  if (count === 0) throw notFound("Project");
}
