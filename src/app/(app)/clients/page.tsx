import type { Metadata } from "next";
import { SearchX, Users } from "lucide-react";
import Link from "next/link";
import { ClientCard } from "@/components/clients/client-card";
import { NewClientButton } from "@/components/clients/new-client-button";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { requireUserOrRedirect } from "@/lib/auth/require-user";
import { buildUrl, first, type RawSearchParams } from "@/lib/search-params";
import { clientListQuerySchema } from "@/modules/clients/schema";
import { ClientsFilters } from "@/components/clients/clients-filters";
import { listClients } from "@/modules/clients/service";
import { getBundle } from "@/modules/settings/server";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const user = await requireUserOrRedirect();
  const ctx = { userId: user.id };
  const { settings } = await getBundle();
  const query = clientListQuerySchema.parse({ status: first(sp.status), q: first(sp.q), page: first(sp.page) });
  const result = await listClients(ctx, query, settings.baseCurrency);
  const filtered = Boolean(query.q || query.status);

  return (
    <>
      <PageHeader title="Clients" description="A lightweight CRM for the people you work with." actions={<NewClientButton />} />
      <ClientsFilters />
      {result.items.length === 0 ? (
        <Card>
          {filtered ? (
            <EmptyState icon={SearchX} title="No clients match your filters" description="Try a different search or status." action={<Link href="/clients" className={buttonVariants({ variant: "outline" })}>Clear filters</Link>} />
          ) : (
            <EmptyState icon={Users} title="No clients yet" description="Add a client to start tracking projects, invoices and revenue." action={<NewClientButton>Add your first client</NewClientButton>} />
          )}
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {result.items.map((c) => (
            <ClientCard key={c.id} client={c} />
          ))}
        </div>
      )}
      <Pagination page={result.page} pageSize={result.pageSize} total={result.total} hrefFor={(p) => buildUrl("/clients", { status: query.status, q: query.q, page: p })} />
    </>
  );
}
