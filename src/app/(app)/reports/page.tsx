import type { Metadata } from "next";
import { RangePicker } from "@/components/reports/range-picker";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedLinks } from "@/components/ui/segmented";
import { requireUserOrRedirect } from "@/lib/auth/require-user";
import { formatIsoDate } from "@/lib/dates";
import { formatMoney, Money } from "@/lib/money";
import { buildUrl, first, type RawSearchParams } from "@/lib/search-params";
import { REPORT_RANGES, resolveRange, type ReportRangeKey } from "@/modules/reports/date-ranges";
import { getBusinessReport, getFinancialReport, getProductivityReport } from "@/modules/reports/service";
import { getBundle } from "@/modules/settings/server";
import { getClock } from "@/modules/shared/clock";

export const metadata: Metadata = { title: "Reports" };

const TABS = ["financial", "business", "productivity"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { financial: "Financial", business: "Business", productivity: "Productivity" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const user = await requireUserOrRedirect();
  const ctx = { userId: user.id };
  const [clock, bundle] = await Promise.all([getClock(user.id), getBundle()]);
  const currency = bundle.settings.baseCurrency;

  const tabParam = first(sp.tab);
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : "financial";
  const rangeParam = first(sp.range);
  const rangeKey: ReportRangeKey = REPORT_RANGES.includes(rangeParam as ReportRangeKey) ? (rangeParam as ReportRangeKey) : "this_month";
  const range = resolveRange(rangeKey, clock.today, clock.weekStartsOn, { from: first(sp.from), to: first(sp.to) });

  return (
    <>
      <PageHeader title="Reports" description="Financial, business and productivity reports." />
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedLinks label="Report type" items={TABS.map((t) => ({ label: TAB_LABEL[t], href: buildUrl("/reports", { tab: t === "financial" ? undefined : t, range: rangeKey, from: range.from, to: range.to }), active: tab === t }))} />
          <RangePicker range={rangeKey} />
        </div>

        {tab === "financial" && <FinancialSection ctx={ctx} range={range} currency={currency} />}
        {tab === "business" && <BusinessSection ctx={ctx} range={range} today={clock.today} currency={currency} dateFormat={bundle.settings.dateFormat} />}
        {tab === "productivity" && <ProductivitySection ctx={ctx} range={range} />}
      </div>
    </>
  );
}

async function FinancialSection({ ctx, range, currency }: { ctx: { userId: string }; range: { from: string; to: string; label: string }; currency: string }) {
  const report = await getFinancialReport(ctx, range, currency);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted">Income</p>
          <p className="tabular mt-1 text-lg font-semibold text-success">{formatMoney(Money.fromDTO(report.income))}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Expenses</p>
          <p className="tabular mt-1 text-lg font-semibold text-danger">{formatMoney(Money.fromDTO(report.expenses))}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Net income</p>
          <p className="tabular mt-1 text-lg font-semibold">{formatMoney(Money.fromDTO(report.net))}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Saved</p>
          <p className="tabular mt-1 text-lg font-semibold">{formatMoney(Money.fromDTO(report.savingsContributed))}</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Expense by category</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {report.expenseByCategory.length === 0 ? <EmptyState title="No expenses in this range" className="py-6" /> : <Table rows={report.expenseByCategory.map((r) => [r.name, formatMoney(Money.fromDTO(r.amount))])} />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Income by client</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {report.incomeByClient.length === 0 ? <EmptyState title="No client income in this range" className="py-6" /> : <Table rows={report.incomeByClient.map((r) => [r.name, formatMoney(Money.fromDTO(r.amount))])} />}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly comparison</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="pb-2 font-medium">Month</th>
                <th className="pb-2 text-right font-medium">Income</th>
                <th className="pb-2 text-right font-medium">Expenses</th>
                <th className="pb-2 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody>
              {report.monthly.map((m) => (
                <tr key={m.month} className="border-b border-line/60">
                  <td className="py-2">{m.label}</td>
                  <td className="tabular py-2 text-right text-success">{formatMoney(Money.fromDTO(m.income))}</td>
                  <td className="tabular py-2 text-right text-danger">{formatMoney(Money.fromDTO(m.expenses))}</td>
                  <td className="tabular py-2 text-right font-medium">{formatMoney(Money.fromDTO(m.net))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

async function BusinessSection({ ctx, range, today, currency, dateFormat }: { ctx: { userId: string }; range: { from: string; to: string; label: string }; today: string; currency: string; dateFormat: string }) {
  const report = await getBusinessReport(ctx, range, today, currency);
  const invoiceTable = (rows: typeof report.paidInvoices, empty: string) =>
    rows.length === 0 ? (
      <EmptyState title={empty} className="py-6" />
    ) : (
      <table className="w-full text-sm">
        <tbody>
          {rows.map((inv) => (
            <tr key={inv.id} className="border-b border-line/60">
              <td className="py-2">{inv.number}</td>
              <td className="py-2 text-muted">{inv.clientName}</td>
              <td className="py-2 text-muted">{formatIsoDate(inv.dueDate, dateFormat)}</td>
              <td className="tabular py-2 text-right font-medium">{formatMoney(Money.fromDTO(inv.total))}</td>
              <td className="tabular py-2 text-right text-muted">{formatMoney(Money.fromDTO(inv.balanceDue))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Client revenue</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">{report.clientRevenue.length === 0 ? <EmptyState title="No client payments in this range" className="py-6" /> : <Table rows={report.clientRevenue.map((r) => [r.name, formatMoney(Money.fromDTO(r.revenue))])} />}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Project revenue</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">{report.projectRevenue.length === 0 ? <EmptyState title="No project revenue yet" className="py-6" /> : <Table rows={report.projectRevenue.map((r) => [`${r.name} · ${r.clientName}`, formatMoney(Money.fromDTO(r.revenue))])} />}</CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Overdue invoices</CardTitle>
          <Badge tone={report.overdueInvoices.length > 0 ? "danger" : "success"}>{report.overdueInvoices.length}</Badge>
        </CardHeader>
        <CardContent className="pt-0">{invoiceTable(report.overdueInvoices, "No overdue invoices")}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Outstanding invoices</CardTitle>
          <Badge tone="warning">{report.outstandingInvoices.length}</Badge>
        </CardHeader>
        <CardContent className="pt-0">{invoiceTable(report.outstandingInvoices, "No outstanding invoices")}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Paid invoices</CardTitle>
          <Badge tone="success">{report.paidInvoices.length}</Badge>
        </CardHeader>
        <CardContent className="pt-0">{invoiceTable(report.paidInvoices, "No invoices paid in this range")}</CardContent>
      </Card>
    </div>
  );
}

async function ProductivitySection({ ctx, range }: { ctx: { userId: string }; range: { from: string; to: string; label: string } }) {
  const report = await getProductivityReport(ctx, range);
  const maxDay = Math.max(1, ...report.dailyCompletions.map((d) => d.count));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted">Tasks completed</p>
          <p className="tabular mt-1 text-2xl font-semibold">{report.tasksCompleted}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Tasks created</p>
          <p className="tabular mt-1 text-2xl font-semibold">{report.tasksCreated}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Habit completion</p>
          <p className="tabular mt-1 text-2xl font-semibold">{report.habitCompletionRate === null ? "—" : `${report.habitCompletionRate}%`}</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tasks completed per day</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {report.dailyCompletions.length === 0 ? (
            <EmptyState title="No data for this range" className="py-6" />
          ) : (
            <div className="flex h-32 items-end gap-1 overflow-x-auto">
              {report.dailyCompletions.map((d) => (
                <div key={d.date} className="flex min-w-3 flex-1 flex-col items-center justify-end" title={`${d.date}: ${d.count}`}>
                  <div className="w-full rounded-t bg-primary" style={{ height: `${(d.count / maxDay) * 100}%`, minHeight: d.count > 0 ? "4px" : "0" }} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Goal progress</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {report.goalProgress.length === 0 ? (
            <EmptyState title="No goals yet" className="py-6" />
          ) : (
            <ul className="divide-y divide-line">
              {report.goalProgress.map((g) => (
                <li key={g.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{g.name}</span>
                  <span className="tabular text-muted">{g.progress}%</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Table({ rows }: { rows: [string, string][] }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} className="border-b border-line/60">
            <td className="py-2">{label}</td>
            <td className="tabular py-2 text-right font-medium">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
