import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientDetailActions } from "@/components/clients/client-detail-actions";
import { NewProjectButton } from "@/components/projects/new-project-button";
import { ProjectRow } from "@/components/projects/project-row";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUserOrRedirect } from "@/lib/auth/require-user";
import { formatIsoDate } from "@/lib/dates";
import { formatMoney, Money } from "@/lib/money";
import { ActivityList } from "@/components/clients/activity-list";
import { getClient, listClientActivity } from "@/modules/clients/service";
import { listInvoicesForClient } from "@/modules/invoices/service";
import { listProjectsForClient } from "@/modules/projects/service";
import { getBundle } from "@/modules/settings/server";
import { getClock } from "@/modules/shared/clock";

export const metadata: Metadata = { title: "Client" };

const STATUS_TONE = { LEAD: "warning", ACTIVE: "success", INACTIVE: "neutral", COMPLETED: "info" } as const;
const STATUS_LABEL = { LEAD: "Lead", ACTIVE: "Active", INACTIVE: "Inactive", COMPLETED: "Completed" } as const;

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUserOrRedirect();
  const ctx = { userId: user.id };
  const [clock, bundle] = await Promise.all([getClock(user.id), getBundle()]);
  const currency = bundle.settings.baseCurrency;
  const client = await getClient(ctx, id, currency);
  if (!client) notFound();

  const [projects, invoices, activity] = await Promise.all([listProjectsForClient(ctx, id, clock.today), listInvoicesForClient(ctx, id, clock.today), listClientActivity(ctx, id)]);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/clients" className="mb-4 inline-flex min-h-10 items-center gap-1 text-sm text-muted hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> All clients
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{client.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone={STATUS_TONE[client.status]}>{STATUS_LABEL[client.status]}</Badge>
            {client.company && <span className="text-sm text-muted">{client.company}</span>}
          </div>
        </div>
        <ClientDetailActions client={client} />
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted">Revenue</p>
          <p className="tabular mt-1 text-lg font-semibold text-success">{formatMoney(Money.fromDTO(client.totalRevenue))}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Outstanding</p>
          <p className="tabular mt-1 text-lg font-semibold">{formatMoney(Money.fromDTO(client.outstanding))}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Projects</p>
          <p className="tabular mt-1 text-lg font-semibold">{projects.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Invoices</p>
          <p className="tabular mt-1 text-lg font-semibold">{invoices.length}</p>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1.5 pt-0 text-sm text-muted">
          {client.email && <p>{client.email}</p>}
          {client.phone && <p>{client.phone}</p>}
          {client.website && <p>{client.website}</p>}
          {client.address && <p>{client.address}</p>}
          {client.country && <p>{client.country}</p>}
          {!client.email && !client.phone && !client.website && !client.address && <p>No contact details yet.</p>}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Projects</CardTitle>
          <NewProjectButton clients={[{ id: client.id, name: client.name }]} defaultClientId={client.id} size="sm" variant="outline" />
        </CardHeader>
        <CardContent className="pt-0">
          {projects.length === 0 ? <EmptyState title="No projects yet" description="Add one to start tracking work for this client." className="py-6" /> : <ul className="divide-y divide-line">{projects.map((p) => <ProjectRow key={p.id} project={p} dateFormat={bundle.settings.dateFormat} />)}</ul>}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {invoices.length === 0 ? (
            <EmptyState title="No invoices yet" description="Create one from the Invoices page." className="py-6" />
          ) : (
            <ul className="divide-y divide-line">
              {invoices.map((inv) => (
                <li key={inv.id}>
                  <Link href={`/invoices/${inv.id}`} className="flex items-center gap-3 py-2.5 hover:bg-surface-2/60">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{inv.number}</span>
                    <span className="text-xs text-muted">{formatIsoDate(inv.dueDate, bundle.settings.dateFormat)}</span>
                    <span className="tabular text-sm font-medium">{formatMoney(Money.fromDTO(inv.total))}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {client.notes && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm whitespace-pre-wrap text-muted">{client.notes}</CardContent>
        </Card>
      )}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Activity history</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ActivityList entries={activity} dateFormat={bundle.settings.dateFormat} />
        </CardContent>
      </Card>
    </div>
  );
}
