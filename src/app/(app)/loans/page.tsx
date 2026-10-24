import type { Metadata } from "next";
import { HandCoins } from "lucide-react";
import { LoanRow } from "@/components/loans/loan-row";
import { NewLoanButton } from "@/components/loans/new-loan-button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedLinks } from "@/components/ui/segmented";
import { requireUserOrRedirect } from "@/lib/auth/require-user";
import { formatMoney, Money, type MoneyDTO } from "@/lib/money";
import { buildUrl, first, type RawSearchParams } from "@/lib/search-params";
import { listAccounts } from "@/modules/finance/service";
import { loanListQuerySchema } from "@/modules/loans/schema";
import { getLoanTotals, listLoans } from "@/modules/loans/service";
import { getBundle } from "@/modules/settings/server";
import { getClock } from "@/modules/shared/clock";

export const metadata: Metadata = { title: "Loans" };

function Amounts({ values, tone }: { values: MoneyDTO[]; tone?: string }) {
  if (values.length === 0) return <p className="tabular mt-1 text-xl font-semibold text-muted">—</p>;
  return (
    <div className="mt-1 space-y-0.5">
      {values.map((v) => (
        <p key={v.currency} className={`tabular text-xl font-semibold ${tone ?? ""}`}>
          {formatMoney(Money.fromDTO(v))}
        </p>
      ))}
    </div>
  );
}

export default async function LoansPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const user = await requireUserOrRedirect();
  const ctx = { userId: user.id };
  const [clock, bundle] = await Promise.all([getClock(user.id), getBundle()]);
  const query = loanListQuerySchema.parse({ direction: first(sp.direction), kind: first(sp.kind), status: first(sp.status) });
  const [loans, totals, accounts] = await Promise.all([listLoans(ctx, clock.today, query), getLoanTotals(ctx, clock.today), listAccounts(ctx)]);
  const accountOptions = accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency }));
  const base = bundle.settings.baseCurrency;
  const link = (over: Record<string, string | undefined>) => buildUrl("/loans", { direction: query.direction, kind: query.kind, status: query.status === "open" ? undefined : query.status, ...over });

  return (
    <>
      <PageHeader
        title="Loans (ধার / কর্জ)"
        description="Money you gave or took — ordinary loans and interest-free Qard al-Hasan (কর্জে হাসানা)."
        actions={<NewLoanButton accounts={accountOptions} defaultDirection={query.direction} defaultCurrency={base} today={clock.today} />}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-muted">To receive (পাবো)</p>
          <Amounts values={totals.receivable} tone="text-success" />
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted">To pay (দেবো)</p>
          <Amounts values={totals.payable} tone="text-danger" />
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted">Qard al-Hasan outstanding</p>
          <div className="mt-1 space-y-0.5 text-sm">
            {totals.qardHasanReceivable.length + totals.qardHasanPayable.length === 0 ? (
              <p className="tabular text-xl font-semibold text-muted">—</p>
            ) : (
              <>
                {totals.qardHasanReceivable.map((v) => (
                  <p key={`r${v.currency}`} className="tabular">
                    <span className="font-semibold">{formatMoney(Money.fromDTO(v))}</span> <span className="text-muted">to receive</span>
                  </p>
                ))}
                {totals.qardHasanPayable.map((v) => (
                  <p key={`p${v.currency}`} className="tabular">
                    <span className="font-semibold">{formatMoney(Money.fromDTO(v))}</span> <span className="text-muted">to pay</span>
                  </p>
                ))}
              </>
            )}
          </div>
          {totals.overdueCount > 0 && <p className="mt-2 text-xs font-medium text-danger">{totals.overdueCount} overdue</p>}
        </Card>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        <SegmentedLinks
          label="Direction"
          items={[
            { label: "I gave (পাবো)", href: link({ direction: "LENT" }), active: query.direction === "LENT" },
            { label: "I took (দেবো)", href: link({ direction: "BORROWED" }), active: query.direction === "BORROWED" },
          ]}
        />
        <SegmentedLinks
          label="Loan type"
          items={[
            { label: "All types", href: link({ kind: undefined }), active: !query.kind },
            { label: "ধার", href: link({ kind: "STANDARD" }), active: query.kind === "STANDARD" },
            { label: "কর্জে হাসানা", href: link({ kind: "QARD_HASAN" }), active: query.kind === "QARD_HASAN" },
          ]}
        />
        <SegmentedLinks
          label="Status"
          items={[
            { label: "Open", href: link({ status: undefined }), active: query.status === "open" },
            { label: "Closed", href: link({ status: "closed" }), active: query.status === "closed" },
            { label: "All", href: link({ status: "all" }), active: query.status === "all" },
          ]}
        />
      </div>

      <div className="mt-4">
        {loans.length === 0 ? (
          <Card>
            <EmptyState
              icon={HandCoins}
              title={query.status === "closed" ? "No closed loans here" : query.direction === "LENT" ? "Nobody owes you money" : "You don't owe anyone"}
              description="Record a loan you gave or took, link it to an account if the money moved, and log repayments as they come in."
              action={
                <NewLoanButton accounts={accountOptions} defaultDirection={query.direction} defaultCurrency={base} today={clock.today} variant="outline">
                  {query.direction === "LENT" ? "Record money I gave" : "Record money I took"}
                </NewLoanButton>
              }
            />
          </Card>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
            {loans.map((l) => (
              <LoanRow key={l.id} loan={l} dateFormat={bundle.settings.dateFormat} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
