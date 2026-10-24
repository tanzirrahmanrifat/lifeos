import type { Metadata } from "next";
import { FileText, SearchX } from "lucide-react";
import Link from "next/link";
import { InvoicesList } from "@/components/invoices/invoices-list";
import { InvoicesToolbar } from "@/components/invoices/invoices-toolbar";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SegmentedLinks } from "@/components/ui/segmented";
import { requireUserOrRedirect } from "@/lib/auth/require-user";
import { buildUrl, first, type RawSearchParams } from "@/lib/search-params";
import { listClientOptions } from "@/modules/clients/service";
import { invoiceListQuerySchema } from "@/modules/invoices/schema";
import { listInvoices } from "@/modules/invoices/service";
import { getBundle } from "@/modules/settings/server";
import { getClock } from "@/modules/shared/clock";

export const metadata: Metadata = { title: "Invoices" };

const SUMMARY_TABS = ["", "DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"] as const;
const TAB_LABEL: Record<string, string> = { "": "All", DRAFT: "Draft", SENT: "Sent", PARTIALLY_PAID: "Partially paid", PAID: "Paid", OVERDUE: "Overdue" };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const user = await requireUserOrRedirect();
  const ctx = { userId: user.id };
  const [clock, bundle, clients] = await Promise.all([getClock(user.id), getBundle(), listClientOptions(ctx)]);
  const query = invoiceListQuerySchema.parse({ status: first(sp.status), clientId: first(sp.clientId), q: first(sp.q), page: first(sp.page) });
  const result = await listInvoices(ctx, query, clock.today);
  const filtered = Boolean(query.q || query.status || query.clientId);

  if (clients.length === 0) {
    return (
      <>
        <PageHeader title="Invoices" description="Professional invoices with automatic numbering." />
        <Card>
          <EmptyState icon={FileText} title="Add a client first" description="Invoices are billed to a client. Add one, then create your first invoice." action={<Link href="/clients" className={buttonVariants({ variant: "outline" })}>Go to clients</Link>} />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Invoices" description="Professional invoices with automatic numbering." actions={<Link href="/invoices/new" className={buttonVariants()}>New invoice</Link>} />
      <div className="space-y-4">
        <SegmentedLinks label="Invoice status" items={SUMMARY_TABS.map((s) => ({ label: TAB_LABEL[s]!, href: buildUrl("/invoices", { status: s || undefined }), active: (query.status ?? "") === s, count: s ? result.statusCounts[s] : undefined }))} />
        <InvoicesToolbar clients={clients} />
        {result.items.length === 0 ? (
          <Card>
            {filtered ? (
              <EmptyState icon={SearchX} title="No invoices match your filters" description="Try different filters." action={<Link href="/invoices" className={buttonVariants({ variant: "outline" })}>Clear filters</Link>} />
            ) : (
              <EmptyState icon={FileText} title="No invoices yet" description="Create your first invoice." action={<Link href="/invoices/new" className={buttonVariants({ variant: "outline" })}>New invoice</Link>} />
            )}
          </Card>
        ) : (
          <InvoicesList invoices={result.items} today={clock.today} dateFormat={bundle.settings.dateFormat} />
        )}
        <Pagination page={result.page} pageSize={result.pageSize} total={result.total} hrefFor={(p) => buildUrl("/invoices", { status: query.status, clientId: query.clientId, q: query.q, page: p })} />
      </div>
    </>
  );
}
