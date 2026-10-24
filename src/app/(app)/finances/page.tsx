import type { Metadata } from "next";
import { SearchX, Wallet } from "lucide-react";
import Link from "next/link";
import { NewAccountButton } from "@/components/finance/new-account-button";
import { NewTransactionButton } from "@/components/finance/new-transaction-button";
import { NewTransferButton } from "@/components/finance/new-transfer-button";
import { AccountCard } from "@/components/finance/account-card";
import { BudgetEditor } from "@/components/finance/budget-editor";
import { FinanceToolbar } from "@/components/finance/finance-toolbar";
import { TransactionsList } from "@/components/finance/transactions-list";
import { TransfersList } from "@/components/finance/transfers-list";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SegmentedLinks } from "@/components/ui/segmented";
import { requireUserOrRedirect } from "@/lib/auth/require-user";
import { addMonthsIso } from "@/lib/dates";
import { formatMoney, Money } from "@/lib/money";
import { buildUrl, first, type RawSearchParams } from "@/lib/search-params";
import { getBudgetSummary, listAccounts, listTransactions, listTransfers } from "@/modules/finance/service";
import { transactionListQuerySchema } from "@/modules/finance/schema";
import { getBundle } from "@/modules/settings/server";
import { listCategoriesOfType } from "@/modules/settings/service";
import { getClock } from "@/modules/shared/clock";

export const metadata: Metadata = { title: "Finances" };

const TABS = ["transactions", "accounts", "budgets", "transfers"] as const;
type Tab = (typeof TABS)[number];

export default async function FinancesPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const user = await requireUserOrRedirect();
  const ctx = { userId: user.id };
  const [clock, bundle] = await Promise.all([getClock(user.id), getBundle()]);
  const currency = bundle.settings.baseCurrency;

  const tabParam = first(sp.tab);
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : "transactions";

  const [accounts, incomeCats, expenseCats] = await Promise.all([listAccounts(ctx, { includeArchived: true }), listCategoriesOfType(ctx, "INCOME"), listCategoriesOfType(ctx, "EXPENSE")]);
  const activeAccounts = accounts.filter((a) => !a.archived);
  const accountOptions = activeAccounts.map((a) => ({ id: a.id, name: a.name }));
  const totalBalance = accounts.filter((a) => a.balance.currency === currency && !a.archived).reduce((sum, a) => sum.add(Money.fromDTO(a.balance)), Money.zero(currency));

  return (
    <>
      <PageHeader
        title="Finances"
        description="Accounts, income, expenses, transfers and budgets."
        actions={
          <>
            <NewTransactionButton accounts={accountOptions} incomeCategories={incomeCats} expenseCategories={expenseCats} today={clock.today} variant="outline" size="sm" defaultType="EXPENSE" />
            <NewTransactionButton accounts={accountOptions} incomeCategories={incomeCats} expenseCategories={expenseCats} today={clock.today} variant="outline" size="sm" defaultType="INCOME" />
            <NewTransferButton accounts={activeAccounts} today={clock.today} variant="outline" size="sm" />
          </>
        }
      />

      <Card className="mb-5 p-4 md:p-5">
        <p className="text-sm text-muted">Total balance ({currency})</p>
        <p className="tabular mt-1 text-2xl font-semibold">{formatMoney(totalBalance)}</p>
      </Card>

      <SegmentedLinks
        label="Finance sections"
        items={TABS.map((t) => ({ label: t[0]!.toUpperCase() + t.slice(1), href: buildUrl("/finances", { tab: t === "transactions" ? undefined : t }), active: tab === t }))}
      />

      <div className="mt-4">
        {tab === "accounts" && <AccountsTab accounts={accounts} />}
        {tab === "transactions" && <TransactionsTab searchParams={sp} accountOptions={accountOptions} incomeCats={incomeCats} expenseCats={expenseCats} today={clock.today} dateFormat={bundle.settings.dateFormat} ctx={ctx} />}
        {tab === "transfers" && <TransfersTab ctx={ctx} dateFormat={bundle.settings.dateFormat} activeAccounts={activeAccounts} clock={clock} />}
        {tab === "budgets" && <BudgetsTab searchParams={sp} ctx={ctx} currency={currency} today={clock.today} />}
      </div>
    </>
  );
}

async function AccountsTab({ accounts }: { accounts: Awaited<ReturnType<typeof listAccounts>> }) {
  if (accounts.length === 0) {
    return (
      <Card>
        <EmptyState icon={Wallet} title="No accounts yet" description="Add the places you keep money — cash, a bank account, a wallet — and every transaction updates its balance automatically." action={<NewAccountButton>Add your first account</NewAccountButton>} />
      </Card>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {accounts.map((a) => (
        <AccountCard key={a.id} account={a} hasActivity={false} />
      ))}
    </div>
  );
}

async function TransactionsTab({
  searchParams,
  accountOptions,
  incomeCats,
  expenseCats,
  today,
  dateFormat,
  ctx,
}: {
  searchParams: RawSearchParams;
  accountOptions: { id: string; name: string }[];
  incomeCats: { id: string; name: string }[];
  expenseCats: { id: string; name: string }[];
  today: string;
  dateFormat: string;
  ctx: { userId: string };
}) {
  const query = transactionListQuerySchema.parse({ type: first(searchParams.type), accountId: first(searchParams.accountId), categoryId: first(searchParams.categoryId), q: first(searchParams.q), page: first(searchParams.page) });
  const result = await listTransactions(ctx, query);
  const allCategories = [...incomeCats, ...expenseCats];
  const filtered = Boolean(query.q || query.type || query.accountId || query.categoryId);

  if (accountOptions.length === 0) {
    return <Card><EmptyState icon={Wallet} title="Add an account first" description="Transactions need somewhere to belong. Add an account, then record your income and expenses." /></Card>;
  }

  return (
    <div className="space-y-4">
      <FinanceToolbar accounts={accountOptions} categories={allCategories} />
      {result.items.length === 0 ? (
        <Card>
          {filtered ? (
            <EmptyState icon={SearchX} title="No transactions match your filters" description="Try different filters, or clear them." action={<Link href="/finances" className={buttonVariants({ variant: "outline" })}>Clear filters</Link>} />
          ) : (
            <EmptyState icon={Wallet} title="No transactions yet" description="Record your first income or expense using the buttons above." />
          )}
        </Card>
      ) : (
        <TransactionsList transactions={result.items} accounts={accountOptions} incomeCategories={incomeCats} expenseCategories={expenseCats} today={today} dateFormat={dateFormat} />
      )}
      <Pagination page={result.page} pageSize={result.pageSize} total={result.total} hrefFor={(p) => buildUrl("/finances", { type: query.type, accountId: query.accountId, categoryId: query.categoryId, q: query.q, page: p })} />
    </div>
  );
}

async function TransfersTab({ ctx, dateFormat, activeAccounts, clock }: { ctx: { userId: string }; dateFormat: string; activeAccounts: Awaited<ReturnType<typeof listAccounts>>; clock: { today: string } }) {
  const transfers = await listTransfers(ctx);
  if (activeAccounts.length < 2) {
    return <Card><EmptyState icon={Wallet} title="You need two accounts to transfer between" description="Add a second account first." /></Card>;
  }
  if (transfers.length === 0) {
    return <Card><EmptyState icon={Wallet} title="No transfers yet" description="Move money between your own accounts and it will show up here." action={<NewTransferButton accounts={activeAccounts} today={clock.today}>Record a transfer</NewTransferButton>} /></Card>;
  }
  return <TransfersList transfers={transfers} dateFormat={dateFormat} />;
}

async function BudgetsTab({ searchParams, ctx, currency, today }: { searchParams: RawSearchParams; ctx: { userId: string }; currency: string; today: string }) {
  const monthParam = first(searchParams.month);
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : today.slice(0, 7);
  const [summary, categories] = await Promise.all([getBudgetSummary(ctx, month, currency), listCategoriesOfType(ctx, "EXPENSE")]);
  const prev = addMonthsIso(`${month}-01`, -1).slice(0, 7);
  const next = addMonthsIso(`${month}-01`, 1).slice(0, 7);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Link href={buildUrl("/finances", { tab: "budgets", month: prev })} scroll={false} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          ← {prev}
        </Link>
        <span className="text-sm font-medium">{month}</span>
        <Link href={buildUrl("/finances", { tab: "budgets", month: next })} scroll={false} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          {next} →
        </Link>
      </div>
      <Card className="p-5">
        <BudgetEditor summary={summary} categories={categories} currency={currency} />
      </Card>
    </div>
  );
}
