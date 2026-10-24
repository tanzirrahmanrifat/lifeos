# LifeOS — personal + business management system

Phase 1 (Foundation) of the build plan: project setup, database schema, authentication, responsive
layout, theme system, dashboard structure and user settings.

## Quick start

```bash
cp .env.example .env
docker compose up -d                # PostgreSQL 16 on :5432 (or point DATABASE_URL at your own)
npm install
npm run db:migrate -- --name init   # creates prisma/migrations and the tables
npm run dev                         # http://localhost:3000  → create your account
```

Optional demo login: `npm run seed:demo` → `demo@lifeos.local` / `demo-password-123`
(development only; refuses to run when `NODE_ENV=production`).

| Command | What it does |
|---|---|
| `npm test` | Unit tests (money, tenant scoping, dates, tokens, invoice numbers) |
| `TEST_DATABASE_URL=… npm test` | Also runs the integration tests against a migrated database |
| `npm run typecheck` / `npm run lint` | TypeScript and ESLint |
| `npm run build` | Production build |

## What's in Phase 1

- **Auth**: email + password (Argon2id), server-side sessions (only a SHA-256 of the cookie token is
  stored), `__Host-` cookie in production, forgot/reset password (single-use 30-minute tokens, every
  session revoked on reset), login/register/reset rate limiting backed by Postgres, no account enumeration.
- **Registration mode** (`REGISTRATION_MODE`): `first-user-only` (default — once your account exists
  nobody else can register), `open`, or `closed`.
- **Layout**: desktop sidebar; phone top bar + drawer + bottom navigation; light/dark/system theme that
  follows your account across devices.
- **Dashboard**: greeting and date in your time zone, summary cards computed on the server from the
  ledger, and the complete widget layout. Widgets whose data doesn't exist yet say which phase delivers
  them — nothing pretends to work.
- **Settings**: profile (+ change email/password), business details, invoice numbering and defaults
  (live preview of `INV-2026-0001`), custom categories (income / expense / task / goal / note),
  notification preferences, appearance, currency, date format, week start.
- **Money library** (`src/lib/money`): integer minor units (`BigInt`), currency-aware exponents
  (JPY 0, USD 2, KWD 3), basis-point tax, exact decimal quantities, explicit rounding, lossless
  `allocate`, strict input parsing.
- **Tenant isolation** (`src/lib/db`): `forUser(userId)` injects `userId` into every query on
  user-owned models and fails closed on anything unexpected.
- **Full database schema** for every planned module (`prisma/schema.prisma`), so later phases add code,
  not schema churn.

## Architecture in one screen

```
src/app/            routes only (pages, layouts, proxy.ts)
src/modules/<x>/    schema.ts (Zod) · service.ts (all business logic) · actions.ts (thin server actions)
src/lib/            money · db (tenant scope) · auth · rate-limit · email · errors · dates · validation
src/components/     ui primitives · layout · forms · feature components
```

Every server action: authenticate → validate with Zod on the server → call a service with `{ userId }`
→ return `{ ok, data | error }`. Services never trust the client, and the same services will back the
future AI assistant and mobile API.

## Deviations from the approved plan (all small)

- **Currency catalogue is code, not a table** (`src/lib/money/currencies.ts`): it never changes at
  runtime and this keeps the types honest.
- **UI primitives are shadcn-style components written by hand on Radix**, because the shadcn CLI needs
  network access that wasn't available. Same pattern, so real shadcn components can sit alongside them.
- **Business logo and profile picture are marked "coming later"** — they need the file-storage layer.

## Known limits (tracked for later phases)

- Dashboard totals count only records in your main currency; explicit FX conversion arrives with Phase 3.
- Two constraints Prisma can't express are added in the migrations that need them: a partial unique
  index for budgets without a category, and the "exactly one owner" CHECK on attachments.
- No strict Content-Security-Policy yet (Phase 7 hardening); basic security headers are already set.
- Email verification is not enforced (single-user install); `emailVerifiedAt` exists for later.
- Rate limiting trusts `X-Forwarded-For`; deploy behind a proxy that overwrites it (most hosts do).

## Phase 2 — Productivity (this update)

Adds Tasks, Habits, Goals, Calendar and Notes, all fully working (not placeholders).

- **Tasks**: today / upcoming / overdue / completed / all views, subtasks, tags, categories, priorities, recurring tasks (daily/weekly/monthly/custom — completing one creates the next automatically), search, filters, server-side pagination.
- **Habits**: daily, specific weekdays, N-times-a-week, N-times-a-month. One-tap done/undo, current & longest streaks, completion rate, weekly/monthly progress, a tappable month calendar you can back-fill, archive (keeps history) or delete.
- **Goals**: milestones with a progress bar that updates automatically, or a manual percentage; status, target dates, days-left/overdue.
- **Calendar**: month / week / day views, merges tasks, events, goal deadlines and milestones, plus a per-day habit summary; click any day to see and manage its agenda.
- **Notes**: categories, tags, pin-to-top, full-text search.
- **Dashboard**: Today's tasks, Today's habits and Upcoming are now live, computed on the server from your data. Quick-add for tasks/habits/goals works from the dashboard.

New database migration: `prisma/migrations/20260921120000_phase2_habit_category` (adds the `HABIT` category type). Run `npx prisma migrate deploy` against your database — see the redeploy note below.

Money-handling deviation: none. Time-handling note: calendar dates are stored and compared as plain `yyyy-mm-dd` strings end-to-end (never as instants), so a due date can never shift because of a time zone; only calendar *events* (which have a clock time) convert to/from your time zone, correctly across daylight-saving changes.

## Phase 3 — Finance (this update)

Adds Accounts, Income/Expenses, Transfers, Budgets, Savings, and Financial Goals — real money handling, not placeholders.

- **Accounts**: cash, bank, wallet, credit card, business, or savings. Every income/expense/transfer atomically updates the account's balance in the same database transaction — tested for concurrent writes, edits that move a transaction between accounts, and deletes, so the balance can never drift from the ledger. Currency locks once an account has any activity. Empty accounts can be deleted; accounts with history are archived instead (kept for the record).
- **Transactions**: income and expense, with category, vendor/source, notes, search, filters (type/account/category), and server-side pagination.
- **Transfers**: move money between two of your own accounts — same currency forces the amounts to match (no accidental typo drift); different currencies let you enter what actually arrived.
- **Budgets**: monthly income target, savings target, and a per-category expense budget, compared against real spending for that month.
- **Financial goals & savings**: a target amount and (optionally) a date; log contributions either as a pure earmark or linked to a real account (which then actually moves the money out of that account). Progress, remaining amount, and the required monthly saving to hit the target date are all computed automatically. A goal is marked Achieved once contributions reach the target.
- **Dashboard**: Financial overview (income vs. expenses, last 6 months), Expense breakdown (this month, by category), Financial goals, and Recent transactions are now all live.

New migration: `prisma/migrations/20260922080000_phase3_budget_null_category` — a partial unique index so Postgres can't create duplicate monthly income/savings-target budget rows (Postgres treats NULL as distinct in a normal unique constraint, so this closes that specific gap). Run `npx prisma migrate deploy` as before.

**Known limitation, by design (documented earlier)**: dashboard totals and budgets only count transactions in your account's own currency matching your base currency — cross-currency roll-ups need an FX-conversion layer, which isn't built yet. Everything within one currency is exact to the cent (tested).

## Phase 4 — Business (this update)

Adds Clients, Projects, Invoices, and Payments — the full chain from client to cash in hand.

- **Clients**: lead/active/inactive/completed CRM, with revenue and outstanding balance computed live from real payments and invoices (never a stored total that can drift).
- **Projects**: linked to a client, with budget, deadline, progress, their own tasks (tasks can now be linked to a project), and revenue/expenses computed from that project's invoices and linked transactions.
- **Invoices**: automatic numbering (`INV-2026-0001`, configurable prefix/padding/year-reset from Settings, race-tested — 10 concurrent invoice creations never collide), multi-line items with per-line discount and tax, server-computed totals that always add up exactly (subtotal − discount + tax = total, to the cent, every time), draft → sent → viewed → partially paid/paid → cancelled, and downloadable PDF.
- **Payments**: recording a payment atomically updates the invoice's paid amount and status, creates the matching income transaction (categorised "Client payment"), and updates the account balance — all three always move together or not at all. A payment can't exceed the remaining balance, and voiding one cleanly reverses every step. Once an invoice has a payment, its line items lock (edit by cancelling and reissuing) — this was the recommendation from the original architecture proposal.
- **Dashboard**: Invoice summary is now live.

**Deviation worth flagging**: PDF invoices use `@react-pdf/renderer` (works well on Vercel's serverless functions, matching the original plan). Standard PDF fonts don't include the ৳ or ₹ symbols, so the PDF prints amounts as "USD 1,100.00" (currency code) rather than a symbol — the in-app screens still show the proper symbol.

**Known limitation**: "Viewed" is marked manually from the invoice page for now; there's no public, token-based invoice link yet to detect an actual client visit, so this is honest tracking rather than automatic. Overdue is computed for display only (not written back to the database), matching the plan from Phase 1.

Run the usual `npx prisma migrate deploy` before redeploying — no new migrations this phase, since the tables already existed in the original schema.

## Phases 5 & 6 — Integration and Reports (this update)

### Phase 5 — Integration
- **Global search** (⌘K / Ctrl+K, or the search icon in the top bar): searches tasks, clients, projects, invoices, transactions, goals, financial goals, habits and notes at once, grouped, with keyboard navigation. Debounced, capped per group so it stays fast, and always scoped to your own data.
- **Calendar now shows invoice due dates and project deadlines** alongside tasks, events, goal deadlines and milestones, each linking to its record. Calendar events can also be linked to a client, so client meetings are tracked as such.
- **Client activity history**: every client page now has a running timeline — client added, projects created, invoices created/sent, payments recorded/voided — newest first.
- Most of "connect invoices → payments → income → accounts → clients → projects → dashboard" was built into Phases 3–4 as it went (payments create income and move account balances; client/project revenue is computed live from real payments, never stored separately), so this phase adds the remaining cross-module glue above.

### Phase 6 — Reports
A new **Reports** page with three tabs and a date-range picker (Today / This week / This month / Last month / This year / Custom):
- **Financial**: income, expenses, net income, amount saved toward goals, expense by category, income by client, and a month-by-month comparison table.
- **Business**: client revenue, project revenue, and invoices bucketed into overdue / outstanding / paid.
- **Productivity**: tasks completed and created, habit completion rate, a per-day tasks-completed chart, and goal progress.

Deliberately not built yet (Phase 7 — Polish): in-app notifications, and CSV/PDF export of reports.

No new database migrations this phase. Run `npx prisma migrate deploy` as usual (it will report nothing to apply if you're already up to date).

## Automatic migrations on deploy (this update)

`npm run build` now runs `prisma migrate deploy` before building, so pushing new code and redeploying is enough — no more manual `npx prisma migrate deploy` from a terminal after every update that adds a migration.

**One-time setup**: add a `DIRECT_URL` environment variable in Vercel with the same value as `DATABASE_URL_UNPOOLED` (Neon already provides both, but only `DATABASE_URL` gets used by the app itself — `DIRECT_URL` is used only for the migration step). This is needed because Postgres advisory locks — which `prisma migrate deploy` takes to stop two simultaneous deploys from migrating at once — don't work through PgBouncer's pooled connection, which is what `DATABASE_URL` normally points at.

Without `DIRECT_URL` set, the build script falls back to `DATABASE_URL`, so nothing breaks — it just means migrations run against the pooled connection, which usually works for a single-deploy-at-a-time setup like this one, but `DIRECT_URL` is the correct, recommended way to set it up.
