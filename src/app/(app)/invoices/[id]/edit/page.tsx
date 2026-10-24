import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireUserOrRedirect } from "@/lib/auth/require-user";
import { listClientOptions } from "@/modules/clients/service";
import { getInvoice } from "@/modules/invoices/service";
import { listProjects } from "@/modules/projects/service";
import { getBundle } from "@/modules/settings/server";
import { getClock } from "@/modules/shared/clock";

export const metadata: Metadata = { title: "Edit invoice" };

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUserOrRedirect();
  const ctx = { userId: user.id };
  const [clock, , clients] = await Promise.all([getClock(user.id), getBundle(), listClientOptions(ctx)]);
  const invoice = await getInvoice(ctx, id, clock.today);
  if (!invoice) notFound();
  if (invoice.locked) notFound(); // paid/partially-paid invoices can't be edited — nothing useful to show here

  const projects = await listProjects(ctx, { page: 1 }, clock.today);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Edit ${invoice.number}`} />
      <InvoiceForm invoice={invoice} clients={clients} projects={projects.items.map((p) => ({ id: p.id, name: p.name, clientId: p.clientId }))} defaults={{ issueDate: invoice.issueDate, dueDate: invoice.dueDate, currency: invoice.currency, notes: invoice.notes ?? "" }} />
    </div>
  );
}
