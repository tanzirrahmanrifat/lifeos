"use client";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import type { FinancialGoalDTO } from "@/modules/financial-goals/types";
import { FinancialGoalFormDialog } from "./goal-form-dialog";

export function GoalDetailActions({ goal, categories }: { goal: FinancialGoalDTO; categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setEditing(true)}>
        <Pencil className="size-4" aria-hidden /> Edit
      </Button>
      <FinancialGoalFormDialog open={editing} onOpenChange={setEditing} goal={goal} categories={categories} currency={goal.target.currency} onDeleted={() => router.replace("/financial-goals")} />
    </>
  );
}
