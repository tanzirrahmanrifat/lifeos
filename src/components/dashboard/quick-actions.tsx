"use client";
import Link from "next/link";
import { FilePlus2, UserPlus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { NewClientButton } from "@/components/clients/new-client-button";
import { NewGoalButton } from "@/components/goals/new-goal-button";
import { NewHabitButton } from "@/components/habits/new-habit-button";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { NewTransactionButton } from "@/components/finance/new-transaction-button";

interface Options {
  taskCategories: { id: string; name: string }[];
  habitCategories: { id: string; name: string }[];
  goalCategories: { id: string; name: string }[];
  accounts: { id: string; name: string }[];
  incomeCategories: { id: string; name: string }[];
  expenseCategories: { id: string; name: string }[];
  today: string;
}

/** Fast-add buttons. Every one of these now opens a real form or goes to a real page. */
export function QuickActions({ taskCategories, habitCategories, goalCategories, accounts, incomeCategories, expenseCategories, today }: Options) {
  return (
    <section aria-label="Quick actions">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        <NewTaskButton categories={taskCategories} defaultDueDate={today} variant="outline" size="sm" className="h-10 shrink-0" />
        <NewHabitButton categories={habitCategories} today={today} variant="outline" size="sm" className="h-10 shrink-0" />
        <NewGoalButton categories={goalCategories} variant="outline" size="sm" className="h-10 shrink-0" />
        {accounts.length > 0 && (
          <>
            <NewTransactionButton accounts={accounts} incomeCategories={incomeCategories} expenseCategories={expenseCategories} defaultType="INCOME" today={today} variant="outline" size="sm" className="h-10 shrink-0" />
            <NewTransactionButton accounts={accounts} incomeCategories={incomeCategories} expenseCategories={expenseCategories} defaultType="EXPENSE" today={today} variant="outline" size="sm" className="h-10 shrink-0" />
          </>
        )}
        <NewClientButton variant="outline" size="sm" className="h-10 shrink-0">
          <UserPlus className="size-4" aria-hidden /> Add client
        </NewClientButton>
        <Link href="/invoices/new" className={buttonVariants({ variant: "outline", size: "sm", className: "h-10 shrink-0" })}>
          <FilePlus2 className="size-4" aria-hidden /> Create invoice
        </Link>
      </div>
      {accounts.length === 0 && <p className="mt-2 text-xs text-muted">Add an account on the Finances page to start recording income and expenses.</p>}
    </section>
  );
}
