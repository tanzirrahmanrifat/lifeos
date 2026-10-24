-- Loans (ধার / কর্জে হাসানা) and donations (দান).
-- Additive only: new enum values, new tables, and three nullable columns on "transactions".
-- No existing row is rewritten.

-- New enum values. They are not used anywhere in this migration, so adding them inside the
-- migration's transaction is safe on PostgreSQL 12+.
ALTER TYPE "CategoryType" ADD VALUE 'DONATION';
ALTER TYPE "TransactionType" ADD VALUE 'LOAN_IN';
ALTER TYPE "TransactionType" ADD VALUE 'LOAN_OUT';

CREATE TYPE "LoanDirection" AS ENUM ('LENT', 'BORROWED');
CREATE TYPE "LoanKind" AS ENUM ('STANDARD', 'QARD_HASAN');

-- Loans
CREATE TABLE "loans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "direction" "LoanDirection" NOT NULL,
    "kind" "LoanKind" NOT NULL DEFAULT 'STANDARD',
    "personName" TEXT NOT NULL,
    "personPhone" TEXT,
    "principalMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dueDate" DATE,
    "accountId" TEXT,
    "repaidMinor" BIGINT NOT NULL DEFAULT 0,
    "forgivenMinor" BIGINT NOT NULL DEFAULT 0,
    "forgivenAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "loan_repayments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "accountId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "loan_repayments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "donations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipient" TEXT,
    "categoryId" TEXT,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "accountId" TEXT,
    "loanId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "donations_pkey" PRIMARY KEY ("id")
);

-- Links from the ledger back to the record that created each leg.
ALTER TABLE "transactions" ADD COLUMN "loanId" TEXT;
ALTER TABLE "transactions" ADD COLUMN "loanRepaymentId" TEXT;
ALTER TABLE "transactions" ADD COLUMN "donationId" TEXT;

-- Indexes
CREATE INDEX "loans_userId_direction_deletedAt_idx" ON "loans"("userId", "direction", "deletedAt");
CREATE INDEX "loans_userId_dueDate_idx" ON "loans"("userId", "dueDate");
CREATE INDEX "loan_repayments_loanId_idx" ON "loan_repayments"("loanId");
CREATE INDEX "loan_repayments_userId_date_idx" ON "loan_repayments"("userId", "date");
CREATE INDEX "donations_userId_date_idx" ON "donations"("userId", "date");
CREATE INDEX "donations_userId_categoryId_idx" ON "donations"("userId", "categoryId");
CREATE UNIQUE INDEX "transactions_loanId_key" ON "transactions"("loanId");
CREATE UNIQUE INDEX "transactions_loanRepaymentId_key" ON "transactions"("loanRepaymentId");
CREATE UNIQUE INDEX "transactions_donationId_key" ON "transactions"("donationId");

-- Foreign keys
ALTER TABLE "loans" ADD CONSTRAINT "loans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loans" ADD CONSTRAINT "loans_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "donations" ADD CONSTRAINT "donations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "donations" ADD CONSTRAINT "donations_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "transaction_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "donations" ADD CONSTRAINT "donations_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "donations" ADD CONSTRAINT "donations_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_loanRepaymentId_fkey" FOREIGN KEY ("loanRepaymentId") REFERENCES "loan_repayments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "donations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
