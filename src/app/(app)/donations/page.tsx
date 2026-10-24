import type { Metadata } from "next";
import { HandHeart } from "lucide-react";
import Link from "next/link";
import { DonationsList } from "@/components/donations/donations-list";
import { NewDonationButton } from "@/components/donations/new-donation-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedLinks } from "@/components/ui/segmented";
import { requireUserOrRedirect } from "@/lib/auth/require-user";
import { formatMoney, Money, type MoneyDTO } from "@/lib/money";
import { buildUrl, first, type RawSearchParams } from "@/lib/search-params";
import { donationListQuerySchema } from "@/modules/donations/schema";
import { getDonationSummary, listDonations } from "@/modules/donations/service";
import { listAccounts } from "@/modules/finance/service";
import { getBundle } from "@/modules/settings/server";
import { listCategoriesOfType } from "@/modules/settings/service";
import { getClock } from "@/modules/shared/clock";

export const metadata: Metadata = { title: "Donations" };

function Totals({ label, values }: { label: string; values: MoneyDTO[] }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted">{label}</p>
      {values.length === 0 ? (
        <p className="tabular mt-1 text-xl font-semibold text-muted">—</p>
      ) : (
        <div className="mt-1 space-y-0.5">
          {values.map((v) => (
            <p key={v.currency} className="tabular text-xl font-semibold">
              {formatMoney(Money.fromDTO(v))}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}

export default async function DonationsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const user = await requireUserOrRedirect();
  const ctx = { userId: user.id };
  const [clock, bundle] = await Promise.all([getClock(user.id), getBundle()]);
  const query = donationListQuerySchema.parse({ year: first(sp.year), categoryId: first(sp.categoryId) });
  const [categories, accounts, summary, donations] = await Promise.all([
    listCategoriesOfType(ctx, "DONATION"),
    listAccounts(ctx),
    getDonationSummary(ctx, clock.today, query.year),
    listDonations(ctx, query, clock.today),
  ]);
  const accountOptions = accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency }));
  const base = bundle.settings.baseCurrency;
  const year = summary.year;
  const isCurrentYear = year === Number(clock.today.slice(0, 4));
  const newButton = (label?: string) => (
    <NewDonationButton categories={categories} accounts={accountOptions} defaultCurrency={base} today={clock.today} variant={label ? "outline" : undefined}>
      {label}
    </NewDonationButton>
  );

  return (
    <>
      <PageHeader title="Donations (দান)" description="Sadaqah, Zakat, Fitra and every other gift — totals by month, year and type." actions={newButton()} />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Totals label="This month" values={summary.thisMonth} />
        <Totals label={isCurrentYear ? "This year" : `In ${year}`} values={summary.thisYear} />
        <Totals label="All time" values={summary.allTime} />
      </div>

      <SegmentedLinks label="Year" items={summary.years.map((y) => ({ label: String(y), href: buildUrl("/donations", { year: y === Number(clock.today.slice(0, 4)) ? undefined : y }), active: y === year }))} />

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-3">
          {query.categoryId && (
            <p className="text-sm text-muted">
              Showing one type only ·{" "}
              <Link className="underline" href={buildUrl("/donations", { year: query.year })}>
                show all
              </Link>
            </p>
          )}
          {donations.length === 0 ? (
            <Card>
              <EmptyState icon={HandHeart} title={`No donations recorded in ${year}`} description="Record each gift with its type (Sadaqah, Zakat…) to see your totals here." action={newButton("Record a donation")} />
            </Card>
          ) : (
            <DonationsList donations={donations} categories={categories} accounts={accountOptions} defaultCurrency={base} today={clock.today} dateFormat={bundle.settings.dateFormat} />
          )}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>By type · {year}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {summary.byCategory.length === 0 ? (
              <p className="text-sm text-muted">Nothing yet.</p>
            ) : (
              <ul className="space-y-2">
                {summary.byCategory.map((c) => (
                  <li key={c.categoryId ?? "none"}>
                    <Link href={buildUrl("/donations", { year: query.year, categoryId: c.categoryId ?? undefined })} className="flex items-start gap-2 rounded-control text-sm hover:text-primary">
                      <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: c.categoryColor ?? "var(--muted)" }} />
                      <span className="flex-1">{c.categoryName}</span>
                      <span className="tabular text-right font-medium">
                        {c.totals.map((t) => (
                          <span key={t.currency} className="block">
                            {formatMoney(Money.fromDTO(t))}
                          </span>
                        ))}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
