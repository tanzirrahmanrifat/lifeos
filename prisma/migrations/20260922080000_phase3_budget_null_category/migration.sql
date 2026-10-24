-- Phase 3: Postgres treats NULL as distinct in a unique constraint, so the existing
-- (userId, month, kind, categoryId) unique index does not stop duplicate INCOME_TARGET /
-- SAVINGS_TARGET rows (which always have categoryId = NULL). This partial unique index closes
-- that gap so the upsert in saveBudget() can never create a second row for the same month.
CREATE UNIQUE INDEX "budgets_userId_month_kind_null_category_key"
  ON "budgets" ("userId", "month", "kind")
  WHERE "categoryId" IS NULL;
