import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceStatusActions } from "@/components/invoices/invoice-status-actions";
import { STATUS_LABEL, STATUS_TONE } from "@/components/invoices/invoice-meta";
import { RecordPaymentButton } from "@/components/payments/record-payment-dialog";
import { VoidPaymentButton } from "@/components/payments/void-payment-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUserOrRedirect } from "@/lib/auth/require-user";
import { formatIsoDate } from "@/lib/dates";
import { formatMoney, Money } from "@/lib/money";
import { listAccounts } from "@/modules/finance/service";
import { getInvoice } from "@/modules/invoices/service";
import { listPaymentsForInvoice } from "@/modules/payments/service";
import { getBundle } from "@/modules/settings/server";
import { getClock } from "@/modules/shared/clock";

export const metadata: Metadata = { title: "Invoice" };

const METHOD_LABEL: Record<string, string> = { CASH: "Cash", BANK_TRANSFER: "Bank transfer", PAYPAL: "PayPal", WISE: "Wise", STRIPE: "Stripe", OTHER: "Other" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUserOrRedirect();
  const ctx = { userId: user.id };
  const [clock, bundle] = await Promise.all([getClock(user.id), getBundle()]);
  const invoice = await getInvoice(ctx, id, clock.today);
  if (!invoice) notFound();

  const [accounts, payments] = await Promise.all([listAccounts(ctx), listPaymentsForInvoice(ctx, id)]);
  const dateFormat = bundle.settings.dateFormat;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/invoices" className="mb-4 inline-flex min-h-10 items-center gap-1 text-sm text-muted hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> All invoices
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{invoice.number}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone={STATUS_TONE[invoice.displayStatus]}>{STATUS_LABEL[invoice.displayStatus]}</Badge>
            <Link href={`/clients/${invoice.clientId}`} className="text-sm text-primary hover:underline">
              {invoice.clientName}
            </Link>
            {invoice.projectName && <span className="text-sm text-muted">· {invoice.projectName}</span>}
          </div>
        </div>
        <InvoiceStatusActions invoice={invoice} />
      </header>

      <Card className="p-5">
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted">Issue date</p>
            <p className="mt-0.5">{formatIsoDate(invoice.issueDate, dateFormat)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Due date</p>
            <p className="mt-0.5">{formatIsoDate(invoice.dueDate, dateFormat)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Total</p>
            <p className="tabular mt-0.5 font-semibold">{formatMoney(Money.fromDTO(invoice.total))}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Balance due</p>
            <p className={`tabular mt-0.5 font-semibold ${Money.fromDTO(invoice.balanceDue).isPositive() ? "text-danger" : "text-success"}`}>{formatMoney(Money.fromDTO(invoice.balanceDue))}</p>
          </div>
        </div>

        <table className="mt-5 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="pb-2 font-medium">Description</th>
              <th className="pb-2 text-right font-medium">Qty</th>
              <th className="pb-2 text-right font-medium">Rate</th>
              <th className="pb-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-b border-line/60">
                <td className="py-2 pr-2">{item.description}</td>
                <td className="tabular py-2 text-right">{item.quantity}</td>
                <td className="tabular py-2 text-right">{formatMoney(Money.fromDTO(item.rate))}</td>
                <td className="tabular py-2 text-right font-medium">{formatMoney(Money.fromDTO(item.lineTotal))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto mt-4 w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between text-muted">
            <span>Subtotal</span>
            <span className="tabular">{formatMoney(Money.fromDTO(invoice.subtotal))}</span>
          </div>
          {Number(invoice.discount.minor) > 0 && (
            <div className="flex justify-between text-muted">
              <span>Discount</span>
              <span className="tabular">−{formatMoney(Money.fromDTO(invoice.discount))}</span>
            </div>
          )}
          {Number(invoice.tax.minor) > 0 && (
            <div className="flex justify-between text-muted">
              <span>Tax</span>
              <span className="tabular">{formatMoney(Money.fromDTO(invoice.tax))}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-line pt-1.5 font-semibold">
            <span>Total</span>
            <span className="tabular">{formatMoney(Money.fromDTO(invoice.total))}</span>
          </div>
          {Number(invoice.amountPaid.minor) > 0 && (
            <div className="flex justify-between text-success">
              <span>Paid</span>
              <span className="tabular">{formatMoney(Money.fromDTO(invoice.amountPaid))}</span>
            </div>
          )}
        </div>

        {(invoice.paymentTerms || invoice.notes) && (
          <div className="mt-5 space-y-2 border-t border-line pt-4 text-sm text-muted">
            {invoice.paymentTerms && <p>{invoice.paymentTerms}</p>}
            {invoice.notes && <p>{invoice.notes}</p>}
          </div>
        )}
      </Card>

      {invoice.status !== "DRAFT" && invoice.status !== "CANCELLED" && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Payments</CardTitle>
            {Money.fromDTO(invoice.balanceDue).isPositive() && <RecordPaymentButton invoiceId={invoice.id} currency={invoice.currency} balanceDue={invoice.balanceDue} accounts={accounts.filter((a) => !a.archived).map((a) => ({ id: a.id, name: a.name, currency: a.balance.currency }))} today={clock.today} />}
          </CardHeader>
          <CardContent className="pt-0">
            {payments.length === 0 ? (
              <p className="py-4 text-sm text-muted">No payments recorded yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className={`tabular text-sm font-medium ${p.voided ? "text-muted line-through" : "text-success"}`}>{formatMoney(Money.fromDTO(p.amount))}</p>
                      <p className="text-xs text-muted">
                        {formatIsoDate(p.date, dateFormat)} · {METHOD_LABEL[p.method]} · {p.accountName}
                      </p>
                    </div>
                    {!p.voided && <VoidPaymentButton paymentId={p.id} />}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
