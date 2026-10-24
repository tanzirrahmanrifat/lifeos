import type { Metadata } from "next";
import { InvoiceSummaryWidget } from "@/components/dashboard/invoice-summary-widget";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { ExpenseBreakdownWidget } from "@/components/dashboard/expense-breakdown-widget";
import { FinancialGoalsWidget } from "@/components/dashboard/financial-goals-widget";
import { FinancialOverviewWidget } from "@/components/dashboard/financial-overview-widget";
import { RecentTransactionsWidget } from "@/components/dashboard/recent-transactions-widget";
import { TodayHabitsWidget } from "@/components/dashboard/today-habits-widget";
import { TodayTasksWidget } from "@/components/dashboard/today-tasks-widget";
import { UpcomingWidget } from "@/components/dashboard/upcoming-widget";
import { formatLongDate, getLocalNow, greetingFor } from "@/lib/dates";
import { getUpcoming } from "@/modules/calendar/service";
import { getDashboardSummary, getExpenseBreakdown, getMonthlyTrend } from "@/modules/dashboard/service";
import { listAccounts, getRecentTransactions } from "@/modules/finance/service";
import { listInvoices } from "@/modules/invoices/service";
import { listFinancialGoals } from "@/modules/financial-goals/service";
import { getTodayHabits } from "@/modules/habits/service";
import { getBundle } from "@/modules/settings/server";
import { listCategoriesOfType } from "@/modules/settings/service";
import { getClock } from "@/modules/shared/clock";
import { getTodaySnapshot } from "@/modules/tasks/service";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { user, settings } = await getBundle();
  const ctx = { userId: user.id };
  const clock = await getClock(user.id);
  const now = getLocalNow(clock.timeZone);
  const firstName = user.name.split(" ")[0];
  const currency = settings.baseCurrency;

  const [summary, taskSnapshot, habits, upcoming, taskCats, habitCats, goalCats, accounts, incomeCats, expenseCats, trend, breakdown, financialGoals, recentTxns, invoiceList] = await Promise.all([
    getDashboardSummary(ctx, currency, clock.timeZone),
    getTodaySnapshot(ctx, clock.today),
    getTodayHabits(ctx, clock),
    getUpcoming(ctx, clock),
    listCategoriesOfType(ctx, "TASK"),
    listCategoriesOfType(ctx, "HABIT"),
    listCategoriesOfType(ctx, "GOAL"),
    listAccounts(ctx),
    listCategoriesOfType(ctx, "INCOME"),
    listCategoriesOfType(ctx, "EXPENSE"),
    getMonthlyTrend(ctx, currency, clock.today),
    getExpenseBreakdown(ctx, currency, clock.today),
    listFinancialGoals(ctx, clock.today),
    getRecentTransactions(ctx, 8),
    listInvoices(ctx, { page: 1 }, clock.today),
  ]);

  return (
    <div className="space-y-6 md:space-y-8">
      <header>
        <p className="text-sm text-muted">{formatLongDate(clock.timeZone)}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
          {greetingFor(now.hour)}, {firstName}
        </h1>
      </header>

      <QuickActions
        taskCategories={taskCats}
        habitCategories={habitCats}
        goalCategories={goalCats}
        accounts={accounts.filter((a) => !a.archived).map((a) => ({ id: a.id, name: a.name }))}
        incomeCategories={incomeCats}
        expenseCategories={expenseCats}
        today={clock.today}
      />
      <SummaryCards summary={summary} />

      <div className="grid gap-4 lg:grid-cols-3">
        <FinancialOverviewWidget points={trend} currency={currency} />
        <ExpenseBreakdownWidget slices={breakdown} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <TodayTasksWidget overdue={taskSnapshot.overdue} today={taskSnapshot.today} completedToday={taskSnapshot.completedToday} overdueCount={taskSnapshot.overdueCount} />
        <TodayHabitsWidget habits={habits} today={clock.today} />
        <UpcomingWidget items={upcoming} today={clock.today} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <FinancialGoalsWidget goals={financialGoals} />
        <RecentTransactionsWidget transactions={recentTxns} />
        <InvoiceSummaryWidget counts={invoiceList.statusCounts} />
      </div>
    </div>
  );
}
