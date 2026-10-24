import type { Metadata } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HabitDetailActions } from "@/components/habits/habit-detail-actions";
import { HabitIcon } from "@/components/habits/icons";
import { HabitMonth } from "@/components/habits/habit-month";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { requireUserOrRedirect } from "@/lib/auth/require-user";
import { addMonthsIso, formatIsoDate } from "@/lib/dates";
import { first, type RawSearchParams } from "@/lib/search-params";
import { describeFrequency } from "@/modules/habits/labels";
import { monthParamSchema } from "@/modules/habits/schema";
import { getHabit, getHabitMonth } from "@/modules/habits/service";
import { getBundle } from "@/modules/settings/server";
import { listCategoriesOfType } from "@/modules/settings/service";
import { getClock } from "@/modules/shared/clock";

export const metadata: Metadata = { title: "Habit" };

export default async function HabitPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<RawSearchParams> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await requireUserOrRedirect();
  const ctx = { userId: user.id };
  const [clock, bundle] = await Promise.all([getClock(user.id), getBundle()]);

  const requested = monthParamSchema.parse(first(sp.month));
  const monthKey = requested || clock.today.slice(0, 7);
  const [habit, month, categories] = await Promise.all([getHabit(ctx, id, clock), getHabitMonth(ctx, id, monthKey, clock), listCategoriesOfType(ctx, "HABIT")]);
  if (!habit || !month) notFound();

  const prev = addMonthsIso(`${monthKey}-01`, -1).slice(0, 7);
  const next = addMonthsIso(`${monthKey}-01`, 1).slice(0, 7);
  const base = `/habits/${habit.id}`;
  const { stats } = habit;

  const tiles = [
    { label: "Current streak", value: String(stats.currentStreak), unit: habit.frequency === "WEEKLY" ? "weeks" : habit.frequency === "MONTHLY" ? "months" : "days" },
    { label: "Longest streak", value: String(Math.max(stats.longestStreak, stats.currentStreak)), unit: habit.frequency === "WEEKLY" ? "weeks" : habit.frequency === "MONTHLY" ? "months" : "days" },
    { label: "Completion rate", value: stats.completionRate === null ? "—" : `${stats.completionRate}%`, unit: "recent" },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/habits" className="mb-4 inline-flex min-h-10 items-center gap-1 text-sm text-muted hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> All habits
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-12 shrink-0 place-items-center rounded-card text-white" style={{ background: habit.color }}>
            <HabitIcon name={habit.icon} className="size-6" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{habit.name}</h1>
            <p className="text-sm text-muted">
              {describeFrequency(habit)} · since {formatIsoDate(habit.startDate, bundle.settings.dateFormat)}
              {habit.archived && <Badge className="ml-2">Archived</Badge>}
            </p>
          </div>
        </div>
        <HabitDetailActions habit={habit} categories={categories} today={clock.today} />
      </header>
      {habit.description && <p className="-mt-2 mb-6 text-sm text-muted">{habit.description}</p>}

      <section aria-label="Statistics" className="grid grid-cols-3 gap-3">
        {tiles.map((t) => (
          <Card key={t.label} className="p-4">
            <p className="text-xs text-muted">{t.label}</p>
            <p className="tabular mt-1 text-2xl font-semibold">{t.value}</p>
            <p className="text-xs text-muted">{t.unit}</p>
          </Card>
        ))}
      </section>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {[
          { label: "This week", p: stats.week },
          { label: "This month", p: stats.month },
        ].map(({ label, p }) =>
          p && p.target > 0 ? (
            <Card key={label} className="p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted">{label}</span>
                <span className="tabular font-medium">
                  {p.done}/{p.target}
                </span>
              </div>
              <ProgressBar className="mt-2" value={p.done} max={p.target} label={`${label} progress`} />
            </Card>
          ) : null,
        )}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{formatIsoDate(`${monthKey}-01`, "MMMM yyyy")}</CardTitle>
          <div className="flex gap-1">
            <Link href={`${base}?month=${prev}`} aria-label="Previous month" className={buttonVariants({ variant: "ghost", size: "icon" })} scroll={false}>
              <ChevronLeft className="size-4" />
            </Link>
            {monthKey !== clock.today.slice(0, 7) && (
              <Link href={base} className={buttonVariants({ variant: "ghost", size: "sm" })} scroll={false}>
                Today
              </Link>
            )}
            <Link href={`${base}?month=${next}`} aria-label="Next month" className={buttonVariants({ variant: "ghost", size: "icon" })} scroll={false}>
              <ChevronRight className="size-4" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <HabitMonth key={monthKey} habitId={habit.id} month={month} color={habit.color} weekStartsOn={clock.weekStartsOn} today={clock.today} />
        </CardContent>
      </Card>
    </div>
  );
}
