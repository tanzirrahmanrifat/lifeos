"use client";
import * as React from "react";
import { toast } from "sonner";
import { CategorySelect } from "@/components/forms/category-select";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { forgiveLoanAction, unforgiveLoanAction } from "@/modules/loans/actions";

/** Waive the rest of a loan you gave (মাফ), optionally logging it as a donation. */
export function ForgivePanel({ loanId, outstandingLabel, donationCategories }: { loanId: string; outstandingLabel: string; donationCategories: { id: string; name: string }[] }) {
  const [asDonation, setAsDonation] = React.useState(true);
  const [categoryId, setCategoryId] = React.useState(donationCategories.find((c) => c.name.startsWith("Sadaqah"))?.id ?? "");
  const [pending, startTransition] = React.useTransition();

  const forgive = () =>
    startTransition(async () => {
      const res = await forgiveLoanAction({ loanId, recordAsDonation: asDonation, donationCategoryId: asDonation ? categoryId : "" });
      if (res.ok) toast.success(asDonation ? "Loan forgiven and logged as a donation" : "Loan forgiven");
      else toast.error(res.error.message);
    });

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Waive the remaining <span className="font-medium text-foreground">{outstandingLabel}</span>. No account balance changes — the money already left when you gave the loan.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-primary" checked={asDonation} onChange={(e) => setAsDonation(e.target.checked)} />
        Also record it as a donation (দান)
      </label>
      {asDonation && (
        <div className="max-w-sm">
          <CategorySelect id="forgive-category" type="DONATION" categories={donationCategories} value={categoryId} onValueChange={setCategoryId} />
        </div>
      )}
      <ConfirmButton variant="outline" onConfirm={forgive} loading={pending} confirmLabel="Confirm — forgive the rest">
        Forgive the rest (মাফ)
      </ConfirmButton>
    </div>
  );
}

export function UnforgiveButton({ loanId }: { loanId: string }) {
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await unforgiveLoanAction(loanId);
          if (res.ok) toast.success("Forgiveness undone");
          else toast.error(res.error.message);
        })
      }
    >
      Undo forgiveness
    </Button>
  );
}
