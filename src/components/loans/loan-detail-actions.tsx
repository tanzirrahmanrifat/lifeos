"use client";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import type { LoanDTO } from "@/modules/loans/types";
import { LoanFormDialog, type LoanAccountOption } from "./loan-form-dialog";

export function LoanDetailActions({ loan, accounts, today }: { loan: LoanDTO; accounts: LoanAccountOption[]; today: string }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setEditing(true)}>
        <Pencil className="size-4" aria-hidden /> Edit
      </Button>
      <LoanFormDialog open={editing} onOpenChange={setEditing} loan={loan} accounts={accounts} defaultCurrency={loan.principal.currency} today={today} onDeleted={() => router.replace(`/loans?direction=${loan.direction}`)} />
    </>
  );
}
