"use client";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OptionSelect } from "@/components/forms/selects";
import { addContributionAction } from "@/modules/financial-goals/actions";

interface Account {
  id: string;
  name: string;
  currency: string;
}

export function ContributionForm({ goalId, goalCurrency, accounts, today }: { goalId: string; goalCurrency: string; accounts: Account[]; today: string }) {
  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState(today);
  const [sourceAccountId, setSourceAccountId] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const matching = accounts.filter((a) => a.currency === goalCurrency);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount.trim()) return;
    startTransition(async () => {
      const res = await addContributionAction({ goalId, amount, date, sourceAccountId, notes: "" });
      if (res.ok) {
        setAmount("");
        toast.success("Contribution added");
      } else toast.error(res.error.message);
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2 rounded-card border border-line p-4">
      <div className="min-w-0 flex-1 basis-28">
        <label htmlFor="contrib-amount" className="mb-1 block text-xs text-muted">
          Amount ({goalCurrency})
        </label>
        <Input id="contrib-amount" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="basis-36">
        <label htmlFor="contrib-date" className="mb-1 block text-xs text-muted">
          Date
        </label>
        <Input id="contrib-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      {matching.length > 0 && (
        <div className="min-w-0 flex-1 basis-40">
          <label htmlFor="contrib-src" className="mb-1 block text-xs text-muted">
            From account
          </label>
          <OptionSelect id="contrib-src" emptyLabel="Just earmark it" options={matching.map((a) => ({ value: a.id, label: a.name }))} value={sourceAccountId} onChange={(e) => setSourceAccountId(e.target.value)} />
        </div>
      )}
      <Button type="submit" loading={pending} disabled={!amount.trim()}>
        Add
      </Button>
    </form>
  );
}
