"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { useServerForm } from "@/hooks/use-server-form";
import { formatMoney, Money } from "@/lib/money";
import { saveBudgetAction } from "@/modules/finance/actions";
import { budgetInputSchema } from "@/modules/finance/schema";
import type { BudgetSummary } from "@/modules/finance/types";

interface Category {
  id: string;
  name: string;
}

/** minor-unit string (from a DTO) → plain "12.34" for an input's default value. */
function minorToInput(minorStr: string, exponent: number): string {
  if (exponent === 0) return minorStr;
  const n = minorStr.padStart(exponent + 1, "0");
  return `${n.slice(0, -exponent)}.${n.slice(-exponent)}`;
}

export function BudgetEditor({ summary, categories, currency }: { summary: BudgetSummary; categories: Category[]; currency: string }) {
  const exponent = currency === "JPY" || currency === "KRW" || currency === "VND" ? 0 : currency === "KWD" || currency === "BHD" || currency === "OMR" ? 3 : 2;
  const budgeted = new Map(summary.expenseLines.filter((l) => l.budget).map((l) => [l.categoryId, minorToInput(l.budget!.minor, exponent)]));

  const defaultLines = categories.map((c) => ({ categoryId: c.id, amount: budgeted.get(c.id) ?? "" }));
  const { form, submit, pending } = useServerForm({
    schema: budgetInputSchema,
    defaultValues: { month: summary.month, incomeTarget: minorToInput(summary.incomeTarget.minor, exponent), savingsTarget: minorToInput(summary.savingsTarget.minor, exponent), expenseLines: defaultLines },
    action: saveBudgetAction,
    successMessage: "Budget saved",
    resetOnSuccess: false,
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Income target" htmlFor="incomeTarget">
          <Input inputMode="decimal" placeholder="0.00" {...form.register("incomeTarget")} />
        </Field>
        <Field label="Savings target" htmlFor="savingsTarget">
          <Input inputMode="decimal" placeholder="0.00" {...form.register("savingsTarget")} />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Expense budgets by category</p>
        <ul className="divide-y divide-line rounded-card border border-line">
          {categories.map((c, i) => {
            const line = summary.expenseLines.find((l) => l.categoryId === c.id);
            const spent = line ? Money.fromDTO(line.spent) : Money.zero(currency);
            const budgetAmount = line?.budget ? Money.fromDTO(line.budget) : null;
            const over = budgetAmount && spent.compare(budgetAmount) > 0;
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
                <span className={`tabular text-xs ${over ? "font-medium text-danger" : "text-muted"}`}>
                  {spent.isZero() ? "—" : formatMoney(spent)} spent
                </span>
                <Input aria-label={`Budget for ${c.name}`} inputMode="decimal" placeholder="0.00" className="w-28" {...form.register(`expenseLines.${i}.amount` as const)} />
                <input type="hidden" {...form.register(`expenseLines.${i}.categoryId` as const)} />
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          Save budget
        </Button>
      </div>
    </form>
  );
}
