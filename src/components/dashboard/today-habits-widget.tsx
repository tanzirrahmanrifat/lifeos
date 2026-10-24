import { Repeat } from "lucide-react";
import Link from "next/link";
import { HabitIcon } from "@/components/habits/icons";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress";
import { HabitCheckLink } from "./habit-check-link";
import type { HabitDTO } from "@/modules/habits/types";

export function TodayHabitsWidget({ habits, today }: { habits: HabitDTO[]; today: string }) {
  const done = habits.filter((h) => h.stats.doneToday).length;
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Today&apos;s habits</CardTitle>
        <Link href="/habits" className="text-sm font-medium text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <div className="flex-1 px-4 pb-4">
        {habits.length === 0 ? (
          <EmptyState icon={Repeat} title="No habits due today" description="Create a habit to see it here." action={<Link href="/habits" className={buttonVariants({ variant: "outline", size: "sm" })}>Go to habits</Link>} className="py-8" />
        ) : (
          <>
            <ProgressBar value={done} max={habits.length} tone={done === habits.length ? "success" : "primary"} label="Habits done today" className="mb-3" />
            <ul className="space-y-2">
              {habits.map((h) => (
                <li key={h.id} className="flex items-center gap-2.5">
                  <HabitCheckLink habitId={h.id} today={today} initialDone={h.stats.doneToday} color={h.color} label={h.name} />
                  <span className="grid size-6 shrink-0 place-items-center rounded-md text-white" style={{ background: h.color }}>
                    <HabitIcon name={h.icon} className="size-3.5" />
                  </span>
                  <Link href={`/habits/${h.id}`} className="min-w-0 flex-1 truncate text-sm hover:underline">
                    {h.name}
                  </Link>
                  {h.stats.currentStreak > 0 && <span className="tabular text-xs text-muted">{h.stats.currentStreak}🔥</span>}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}
