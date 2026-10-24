import { NextResponse } from "next/server";
import { requireUser, toCtx } from "@/lib/auth/require-user";
import { getInvoice } from "@/modules/invoices/service";
import { renderInvoicePdf } from "@/modules/invoices/pdf";
import { getSettingsBundle } from "@/modules/settings/service";
import { getClient } from "@/modules/clients/service";
import { getClock } from "@/modules/shared/clock";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser().catch(() => null);
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const ctx = toCtx(user);

  const clock = await getClock(user.id);
  const [invoice, bundle] = await Promise.all([getInvoice(ctx, id, clock.today), getSettingsBundle(ctx)]);
  if (!invoice) return new NextResponse("Not found", { status: 404 });
  const client = await getClient(ctx, invoice.clientId, invoice.currency);

  const pdf = await renderInvoicePdf({
    invoice,
    business: bundle.business,
    client: { name: invoice.clientName, company: client?.company ?? null, email: client?.email ?? null, address: client?.address ?? null },
    dateFormat: bundle.settings.dateFormat,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
