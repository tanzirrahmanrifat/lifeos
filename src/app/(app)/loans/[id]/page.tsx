import type { Metadata } from "next";
import { ChevronLeft, Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ForgivePanel, UnforgiveButton } from "@/components/loans/forgive-panel";
import { LoanDetailActions } from "@/components/loans/loan-detail-actions";
import { DIRECTION_LABEL, KIND_LABEL, STATUS_LABEL, STATUS_TONE } from "@/components/loans/loan-meta";
import { RepaymentForm } from "@/components/loans/repayment-form";
import { RepaymentRow } from "@/components/loans/repayment-row";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress";
import { requireUserOrRedirect } from "@/lib/auth/require-user";
import { formatIsoDate } from "@/lib/dates";
import { formatMoney, Money } from "@/lib/money";
import { listAccounts } from "@/modules/finance/service";
import { getLoan } from "@/modules/loans/service";
import { getBundle } from "@/modules/settings/server";
import { listCategoriesOfType } from "@/modules/settings/service";
import { getClock } from "@/modules/shared/clock";

export const metadata: Metadata = { title: "Loan" };

export default async function LoanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUserOrRedirect();
  const ctx = { userId: user.id };
  const [clock, bundle] = await Promise.all([getClock(user.id), getBundle()]);
  const [loan, accounts, donationCategories] = await Promise.all([getLoan(ctx, id, clock.today), listAccounts(ctx), listCategoriesOfType(ctx, "DONATION")]);
  if (!loan) notFound();

  const df = bundle.settings.dateFormat;
  const accountOptions = accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency }));
  const outstanding = Money.fromDTO(loan.outstanding);
  const open = loan.status === "OPEN" || loan.status === "PARTIAL";

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/loans?direction=${loan.direction}`} className="mb-4 inline-flex min-h-10 items-center gap-1 text-sm text-muted hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> All loans
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-muted">{DIRECTION_LABEL[loan.direction]}</p>
          <h1 className="truncate text-2xl font-semibold tracking-tight">{loan.personName}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone={loan.kind === "QARD_HASAN" ? "primary" : "neutral"}>{KIND_LABEL[loan.kind]}</Badge>
            <Badge tone={STATUS_TONE[loan.status]}>{STATUS_LABEL[loan.status]}</Badge>
            {loan.overdue && <Badge tone="danger">Overdue</Badge>}
            {loan.personPhone && (
              <a href={`tel:${loan.personPhone}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
                <Phone className="size-3.5" aria-hidden /> {loan.personPhone}
              </a>
            )}
          </div>
        </div>
        <LoanDetailActions loan={loan} accounts={accountOptions} today={clock.today} />
      </header>

      <Card className="p-5">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-muted">Amount</p>
            <p className="tabular mt-1 font-semibold">{formatMoney(Money.fromDTO(loan.principal))}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Repaid</p>
            <p className="tabular mt-1 font-semibold text-success">{formatMoney(Money.fromDTO(loan.repaid))}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{loan.direction === "LENT" ? "Still to receive" : "Still to pay"}</p>
            <p className="tabular mt-1 font-semibold">{formatMoney(outstanding)}</p>
          </div>
        </div>
        <ProgressBar className="mt-4" value={loan.progressPct} tone={loan.status === "SETTLED" ? "success" : "primary"} label="Repaid so far" />
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">Date</dt>
          <dd>{formatIsoDate(loan.date, df)}</dd>
          {loan.dueDate && (
            <>
              <dt className="text-muted">Due</dt>
              <dd className={loan.overdue ? "font-medium text-danger" : undefined}>{formatIsoDate(loan.dueDate, df)}</dd>
            </>
          )}
          <dt className="text-muted">Account</dt>
          <dd>{loan.accountName ?? "Not linked"}</dd>
          {loan.status === "FORGIVEN" && (
            <>
              <dt className="text-muted">Forgiven</dt>
              <dd>{formatMoney(Money.fromDTO(loan.forgiven))}</dd>
            </>
          )}
        </dl>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Repayments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {open && <RepaymentForm loanId={loan.id} direction={loan.direction} currency={loan.principal.currency} outstanding={outstanding.toMajorString()} accounts={accountOptions} today={clock.today} />}
          {loan.repayments.length === 0 ? (
            <EmptyState title="No repayments yet" description={open ? "Record each repayment above as it comes in." : "Nothing was repaid."} className="py-6" />
          ) : (
            <ul className="divide-y divide-line">
              {loan.repayments.map((r) => (
                <RepaymentRow key={r.id} loanId={loan.id} repayment={r} direction={loan.direction} dateFormat={df} canRemove={loan.status !== "FORGIVEN"} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {loan.direction === "LENT" && (open || loan.status === "FORGIVEN") && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Forgive (মাফ করে দেওয়া)</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loan.status === "FORGIVEN" ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
                <span>You forgave {formatMoney(Money.fromDTO(loan.forgiven))} of this loan.</span>
                <UnforgiveButton loanId={loan.id} />
              </div>
            ) : (
              <ForgivePanel loanId={loan.id} outstandingLabel={formatMoney(outstanding)} donationCategories={donationCategories} />
            )}
          </CardContent>
        </Card>
      )}

      {loan.notes && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap pt-0 text-sm text-muted">{loan.notes}</CardContent>
        </Card>
      )}
    </div>
  );
}
