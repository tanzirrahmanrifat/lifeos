import type { Metadata } from "next";
import { HandCoins } from "lucide-react";
import Link from "next/link";
import { VoidPaymentButton } from "@/components/payments/void-payment-button";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { requireUserOrRedirect } from "@/lib/auth/require-user";
import { buildUrl, first, type RawSearchParams } from "@/lib/search-params";
import { formatIsoDate } from "@/lib/dates";
import { formatMoney, Money } from "@/lib/money";
import { listPayments } from "@/modules/payments/service";
import { getBundle } from "@/modules/settings/server";

export const metadata: Metadata = { title: "Payments" };
const METHOD_LABEL: Record<string, string> = { CASH: "Cash", BANK_TRANSFER: "Bank transfer", PAYPAL: "PayPal", WISE: "Wise", STRIPE: "Stripe", OTHER: "Other" };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const user = await requireUserOrRedirect();
  const ctx = { userId: user.id };
  const { settings } = await getBundle();
  const page = Number(first(sp.page) ?? "1") || 1;
  const result = await listPayments(ctx, page);

  return (
    <>
      <PageHeader title="Payments" description="Every payment recorded against your invoices." />
      {result.items.length === 0 ? (
        <Card>
          <EmptyState icon={HandCoins} title="No payments yet" description="Payments are recorded from an invoice's page once it has been sent." action={<Link href="/invoices" className={buttonVariants({ variant: "outline" })}>Go to invoices</Link>} />
        </Card>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {result.items.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <Link href={`/invoices/${p.invoiceId}`} className="truncate text-sm font-medium hover:underline">
                  {p.invoiceNumber} · {p.clientName}
                </Link>
                <p className="text-xs text-muted">
                  {formatIsoDate(p.date, settings.dateFormat)} · {METHOD_LABEL[p.method]} · {p.accountName}
                </p>
              </div>
              <span className="tabular shrink-0 text-sm font-semibold text-success">{formatMoney(Money.fromDTO(p.amount))}</span>
              <VoidPaymentButton paymentId={p.id} />
            </li>
          ))}
        </ul>
      )}
      <Pagination page={result.page} pageSize={result.pageSize} total={result.total} hrefFor={(p) => buildUrl("/payments", { page: p })} />
    </>
  );
}
