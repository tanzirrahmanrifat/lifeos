import type { Metadata } from "next";
import { FolderKanban, SearchX } from "lucide-react";
import Link from "next/link";
import { NewProjectButton } from "@/components/projects/new-project-button";
import { ProjectCard } from "@/components/projects/project-card";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchBox } from "@/components/ui/search-box";
import { requireUserOrRedirect } from "@/lib/auth/require-user";
import { buildUrl, first, type RawSearchParams } from "@/lib/search-params";
import { listClientOptions } from "@/modules/clients/service";
import { projectListQuerySchema } from "@/modules/projects/schema";
import { listProjects } from "@/modules/projects/service";
import { getBundle } from "@/modules/settings/server";
import { getClock } from "@/modules/shared/clock";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const user = await requireUserOrRedirect();
  const ctx = { userId: user.id };
  const [clock, bundle, clients] = await Promise.all([getClock(user.id), getBundle(), listClientOptions(ctx)]);
  const query = projectListQuerySchema.parse({ status: first(sp.status), clientId: first(sp.clientId), q: first(sp.q), page: first(sp.page) });
  const result = await listProjects(ctx, query, clock.today);
  const filtered = Boolean(query.q || query.status || query.clientId);

  if (clients.length === 0) {
    return (
      <>
        <PageHeader title="Projects" description="Client work from planning to delivery." />
        <Card>
          <EmptyState icon={FolderKanban} title="Add a client first" description="Projects belong to a client. Add a client, then create their first project." action={<Link href="/clients" className={buttonVariants({ variant: "outline" })}>Go to clients</Link>} />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Projects" description="Client work from planning to delivery." actions={<NewProjectButton clients={clients} currency={bundle.settings.baseCurrency} />} />
      <div className="mb-4">
        <SearchBox paramKey="q" placeholder="Search projects" />
      </div>
      {result.items.length === 0 ? (
        <Card>
          {filtered ? (
            <EmptyState icon={SearchX} title="No projects match your filters" description="Try a different search." action={<Link href="/projects" className={buttonVariants({ variant: "outline" })}>Clear filters</Link>} />
          ) : (
            <EmptyState icon={FolderKanban} title="No projects yet" description="Create your first project for a client." action={<NewProjectButton clients={clients} currency={bundle.settings.baseCurrency}>Create your first project</NewProjectButton>} />
          )}
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {result.items.map((p) => (
            <ProjectCard key={p.id} project={p} dateFormat={bundle.settings.dateFormat} />
          ))}
        </div>
      )}
      <Pagination page={result.page} pageSize={result.pageSize} total={result.total} hrefFor={(p) => buildUrl("/projects", { status: query.status, clientId: query.clientId, q: query.q, page: p })} />
    </>
  );
}
