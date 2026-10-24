import type { Metadata } from "next";
import { CalendarHeader } from "@/components/calendar/calendar-header";
import { DayAgenda } from "@/components/calendar/agenda-list";
import { MonthGrid } from "@/components/calendar/month-grid";
import { Card } from "@/components/ui/card";
import { requireUserOrRedirect } from "@/lib/auth/require-user";
import { addDaysIso, addMonthsIso, startOfWeekIso } from "@/lib/dates";
import { buildUrl, first, type RawSearchParams } from "@/lib/search-params";
import { listClientOptions } from "@/modules/clients/service";
import { calendarQuerySchema } from "@/modules/calendar/schema";
import { getCalendarRange } from "@/modules/calendar/service";
import { getClock } from "@/modules/shared/clock";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const user = await requireUserOrRedirect();
  const ctx = { userId: user.id };
  const [clock, clients] = await Promise.all([getClock(user.id), listClientOptions(ctx)]);
  const query = calendarQuerySchema.parse({ view: first(sp.view), date: first(sp.date) });
  const selected = query.date ?? clock.today;

  let from: string;
  let to: string;
  if (query.view === "day") {
    from = to = selected;
  } else if (query.view === "week") {
    from = startOfWeekIso(selected, clock.weekStartsOn);
    to = addDaysIso(from, 6);
  } else {
    const monthStart = `${selected.slice(0, 7)}-01`;
    from = startOfWeekIso(monthStart, clock.weekStartsOn);
    to = addDaysIso(from, 41); // 6 full weeks always covers the month grid
  }

  const range = await getCalendarRange(ctx, clock, from, to);
  const itemsByDay: Record<string, typeof range.items> = {};
  for (const item of range.items) (itemsByDay[item.date] ??= []).push(item);

  const step = query.view === "day" ? 1 : query.view === "week" ? 7 : 0;
  const prevDate = query.view === "month" ? addMonthsIso(selected, -1) : addDaysIso(selected, -step);
  const nextDate = query.view === "month" ? addMonthsIso(selected, 1) : addDaysIso(selected, step);
  const viewParam = query.view === "month" ? undefined : query.view;
  const linkFor = (date: string) => buildUrl("/calendar", { view: viewParam, date });

  const titleFormat = query.view === "month" ? "MMMM yyyy" : query.view === "week" ? "MMM yyyy" : "EEEE d MMM yyyy";

  return (
    <>
      <CalendarHeader view={query.view} selected={selected} todayHref={buildUrl("/calendar", { view: viewParam })} prevHref={linkFor(prevDate)} nextHref={linkFor(nextDate)} titleFormat={titleFormat} clients={clients} />

      {query.view === "day" ? (
        <Card className="mx-auto max-w-xl p-5">
          <DayAgenda date={selected} today={clock.today} items={itemsByDay[selected] ?? []} habitSummary={range.habitDays[selected]} clients={clients} />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <Card className="p-3 sm:p-4">
            <MonthGrid
              month={selected.slice(0, 7)}
              selected={selected}
              today={clock.today}
              weekStartsOn={clock.weekStartsOn}
              itemsByDay={itemsByDay}
              habitDays={range.habitDays}
              daysOverride={query.view === "week" ? Array.from({ length: 7 }, (_, i) => addDaysIso(from, i)) : undefined}
            />
          </Card>
          <Card className="p-5">
            <DayAgenda date={selected} today={clock.today} items={itemsByDay[selected] ?? []} habitSummary={range.habitDays[selected]} clients={clients} />
          </Card>
        </div>
      )}
    </>
  );
}
