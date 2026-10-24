import { CheckCircle2, PartyPopper } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckButtonLink } from "./check-button-link";
import { EmptyState } from "@/components/ui/empty-state";
import { PRIORITY_LABEL, PRIORITY_TONE } from "@/components/tasks/task-meta";
import { cn } from "@/lib/utils";
import type { TaskDTO } from "@/modules/tasks/types";

export function TodayTasksWidget({ overdue, today, completedToday, overdueCount }: { overdue: TaskDTO[]; today: TaskDTO[]; completedToday: number; overdueCount: number }) {
  const items = [...overdue, ...today];
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Today&apos;s tasks</CardTitle>
        <Link href="/tasks" className="text-sm font-medium text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <div className="flex-1 px-2 pb-4">
        {items.length === 0 && completedToday === 0 ? (
          <EmptyState icon={PartyPopper} title="Nothing due today" description="Add a task to get started." action={<Link href="/tasks" className={buttonVariants({ variant: "outline", size: "sm" })}>Go to tasks</Link>} className="py-8" />
        ) : (
          <ul className="space-y-0.5">
            {overdueCount > 0 && (
              <li className="px-3 pb-1 text-xs font-medium text-danger">
                {overdueCount} overdue
              </li>
            )}
            {items.slice(0, 6).map((t) => (
              <li key={t.id} className="flex items-center gap-1 rounded-control px-1 hover:bg-surface-2/60">
                <CheckButtonLink taskId={t.id} label={t.title} />
                <Link href={`/tasks?view=all&edit=${t.id}`} className="min-w-0 flex-1 truncate py-2 text-sm">
                  <span className={cn(t.overdue && "font-medium text-danger")}>{t.title}</span>
                  {t.priority !== "LOW" && t.priority !== "MEDIUM" && <Badge tone={PRIORITY_TONE[t.priority]} className="ml-2">{PRIORITY_LABEL[t.priority]}</Badge>}
                </Link>
              </li>
            ))}
            {completedToday > 0 && (
              <li className="flex items-center gap-1.5 px-3 pt-1.5 text-xs text-muted">
                <CheckCircle2 className="size-3.5 text-success" aria-hidden />
                {completedToday} completed today
              </li>
            )}
          </ul>
        )}
      </div>
    </Card>
  );
}
