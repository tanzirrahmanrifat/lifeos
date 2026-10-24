import type { Metadata } from "next";
import { Repeat } from "lucide-react";
import { HabitCard } from "@/components/habits/habit-card";
import { NewHabitButton } from "@/components/habits/new-habit-button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { requireUserOrRedirect } from "@/lib/auth/require-user";
import { listHabits } from "@/modules/habits/service";
import { listCategoriesOfType } from "@/modules/settings/service";
import { getClock } from "@/modules/shared/clock";

export const metadata: Metadata = { title: "Habits" };

export default async function HabitsPage() {
  const user = await requireUserOrRedirect();
  const ctx = { userId: user.id };
  const clock = await getClock(user.id);
  const [habits, categories] = await Promise.all([listHabits(ctx, clock, { includeArchived: true }), listCategoriesOfType(ctx, "HABIT")]);

  const active = habits.filter((h) => !h.archived);
  const archived = habits.filter((h) => h.archived);
  const dueToday = active.filter((h) => h.dueToday);
  const doneToday = dueToday.filter((h) => h.stats.doneToday).length;
  const newButton = <NewHabitButton categories={categories} today={clock.today} />;

  return (
    <>
      <PageHeader title="Habits" description="Build routines and watch the streaks add up." actions={newButton} />

      {habits.length === 0 ? (
        <Card>
          <EmptyState
            icon={Repeat}
            title="No habits yet"
            description="Pick something you want to do regularly — daily, on certain weekdays, or a few times a week — and check it off with one tap."
            action={<NewHabitButton categories={categories} today={clock.today}>Create your first habit</NewHabitButton>}
          />
        </Card>
      ) : (
        <div className="space-y-8">
          {dueToday.length > 0 && (
            <Card className="p-4 md:p-5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium">Today</p>
                <p className="tabular text-sm text-muted">
                  {doneToday} of {dueToday.length} done
                </p>
              </div>
              <ProgressBar className="mt-2" value={doneToday} max={dueToday.length} tone={doneToday === dueToday.length ? "success" : "primary"} label="Habits done today" />
            </Card>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {active.map((h) => (
              <HabitCard key={`${h.id}-${h.stats.doneToday}`} habit={h} today={clock.today} categories={categories} />
            ))}
          </div>

          {archived.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-sm font-medium text-muted hover:text-foreground">Archived ({archived.length})</summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {archived.map((h) => (
                  <HabitCard key={`${h.id}-${h.stats.doneToday}`} habit={h} today={clock.today} categories={categories} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </>
  );
}
