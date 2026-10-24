"use client";
import * as React from "react";
import { toast } from "sonner";
import { OptionSelect } from "@/components/forms/selects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addRepaymentAction } from "@/modules/loans/actions";
import type { LoanAccountOption } from "./loan-form-dialog";

export function RepaymentForm({ loanId, direction, currency, outstanding, accounts, today }: { loanId: string; direction: "LENT" | "BORROWED"; currency: string; outstanding: string; accounts: LoanAccountOption[]; today: string }) {
  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState(today);
  const [accountId, setAccountId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const matching = accounts.filter((a) => a.currency === currency);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount.trim()) return;
    startTransition(async () => {
      setError(null);
      const res = await addRepaymentAction({ loanId, amount, date, accountId, notes: "" });
      if (res.ok) {
        setAmount("");
        toast.success("Repayment recorded");
      } else setError(res.error.fieldErrors?.amount?.[0] ?? res.error.fieldErrors?.accountId?.[0] ?? res.error.message);
    });
  };

  return (
    <form onSubmit={submit} className="space-y-2 rounded-card border border-line p-4" noValidate>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 basis-28">
          <label htmlFor="repay-amount" className="mb-1 block text-xs text-muted">
            Amount ({currency})
          </label>
          <div className="flex gap-1.5">
            <Input id="repay-amount" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={error ? true : undefined} />
            <Button type="button" variant="ghost" size="sm" className="h-auto" onClick={() => setAmount(outstanding)} title="Fill in the full remaining amount">
              All
            </Button>
          </div>
        </div>
        <div className="basis-36">
          <label htmlFor="repay-date" className="mb-1 block text-xs text-muted">
            Date
          </label>
          <Input id="repay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {matching.length > 0 && (
          <div className="min-w-0 flex-1 basis-40">
            <label htmlFor="repay-account" className="mb-1 block text-xs text-muted">
              {direction === "LENT" ? "Received into" : "Paid from"}
            </label>
            <OptionSelect id="repay-account" emptyLabel="No account" options={matching.map((a) => ({ value: a.id, label: a.name }))} value={accountId} onChange={(e) => setAccountId(e.target.value)} />
          </div>
        )}
        <Button type="submit" loading={pending} disabled={!amount.trim()}>
          Record
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
