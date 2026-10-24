import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { relativeDayLabel } from "@/lib/dates";
import type { CalendarItem } from "@/modules/calendar/types";

const HREF: Record<CalendarItem["kind"], (item: CalendarItem) => string> = {
  task: (i) => `/tasks?view=all&edit=${i.ref.id}`,
  event: () => `/calendar`,
  goal: (i) => `/goals/${i.ref.id}`,
  milestone: (i) => `/goals/${i.ref.parentId ?? i.ref.id}`,
  invoice: (i) => `/invoices/${i.ref.id}`,
  project: (i) => `/projects/${i.ref.id}`,
};

export function UpcomingWidget({ items, today }: { items: CalendarItem[]; today: string }) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Upcoming</CardTitle>
        <Link href="/calendar" className="text-sm font-medium text-primary hover:underline">
          Calendar
        </Link>
      </CardHeader>
      <div className="flex-1 px-2 pb-4">
        {items.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Nothing coming up" description="Tasks, events and goal deadlines will show up here." action={<Link href="/calendar" className={buttonVariants({ variant: "outline", size: "sm" })}>Open calendar</Link>} className="py-8" />
        ) : (
          <ul className="space-y-0.5">
            {items.map((item) => (
              <li key={item.key}>
                <Link href={HREF[item.kind](item)} className="flex items-center gap-2 rounded-control px-3 py-2 text-sm hover:bg-surface-2/60">
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  <span className="shrink-0 text-xs text-muted">{relativeDayLabel(item.date, today)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
