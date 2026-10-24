import type { Metadata } from "next";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireUserOrRedirect } from "@/lib/auth/require-user";
import { addDaysIso } from "@/lib/dates";
import { first, type RawSearchParams } from "@/lib/search-params";
import { listClientOptions } from "@/modules/clients/service";
import { getBundle } from "@/modules/settings/server";
import { getClock } from "@/modules/shared/clock";

export const metadata: Metadata = { title: "New invoice" };

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const user = await requireUserOrRedirect();
  const ctx = { userId: user.id };
  const [clock, bundle, clients] = await Promise.all([getClock(user.id), getBundle(), listClientOptions(ctx)]);
  const { listProjects } = await import("@/modules/projects/service");
  const fullProjects = await listProjects(ctx, { page: 1 }, clock.today);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New invoice" />
      <InvoiceForm
        invoice={null}
        clients={clients}
        projects={fullProjects.items.map((p) => ({ id: p.id, name: p.name, clientId: p.clientId }))}
        defaults={{ issueDate: clock.today, dueDate: addDaysIso(clock.today, bundle.settings.defaultPaymentTermsDays), currency: bundle.settings.baseCurrency, notes: bundle.settings.defaultInvoiceNotes ?? "", clientId: first(sp.clientId) }}
      />
    </div>
  );
}
