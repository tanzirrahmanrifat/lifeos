"use client";
import { CalendarClock, Pencil } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { formatIsoDate } from "@/lib/dates";
import { formatMoney, Money } from "@/lib/money";
import type { FinancialGoalDTO } from "@/modules/financial-goals/types";
import { FinancialGoalFormDialog } from "./goal-form-dialog";

const STATUS_TONE = { ACTIVE: "info", ACHIEVED: "success", PAUSED: "warning", CANCELLED: "neutral" } as const;
const STATUS_LABEL = { ACTIVE: "Active", ACHIEVED: "Achieved", PAUSED: "Paused", CANCELLED: "Cancelled" } as const;

export function FinancialGoalCard({ goal, categories, dateFormat }: { goal: FinancialGoalDTO; categories: { id: string; name: string }[]; dateFormat: string }) {
  const [editing, setEditing] = React.useState(false);
  return (
    <>
      <Card className="flex flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/financial-goals/${goal.id}`} className="block truncate font-medium hover:underline">
              {goal.name}
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge tone={STATUS_TONE[goal.status]}>{STATUS_LABEL[goal.status]}</Badge>
              {goal.categoryName && <Badge tone="neutral">{goal.categoryName}</Badge>}
            </div>
          </div>
          <Button variant="ghost" size="icon" aria-label={`Edit ${goal.name}`} onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
          </Button>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-muted">
              {formatMoney(Money.fromDTO(goal.current))} of {formatMoney(Money.fromDTO(goal.target))}
            </span>
            <span className="tabular font-medium">{goal.progressPct}%</span>
          </div>
          <ProgressBar value={goal.progressPct} tone={goal.status === "ACHIEVED" ? "success" : "primary"} label={`${goal.name} progress`} />
        </div>

        {goal.targetDate && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
            <CalendarClock className="size-3.5" aria-hidden />
            {formatIsoDate(goal.targetDate, dateFormat)}
            {goal.requiredMonthly && ` · ${formatMoney(Money.fromDTO(goal.requiredMonthly))}/mo needed`}
          </p>
        )}
      </Card>
      <FinancialGoalFormDialog open={editing} onOpenChange={setEditing} goal={goal} categories={categories} currency={goal.target.currency} />
    </>
  );
}
