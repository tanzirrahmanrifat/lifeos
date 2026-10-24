"use client";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatIsoDate } from "@/lib/dates";
import { buildUrl } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { EventFormDialog } from "./event-form-dialog";

const VIEWS = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
];

export function CalendarHeader({ view, selected, todayHref, prevHref, nextHref, titleFormat, clients = [] }: { view: string; selected: string; todayHref: string; prevHref: string; nextHref: string; titleFormat: string; clients?: { id: string; name: string }[] }) {
  const pathname = usePathname();
  const [adding, setAdding] = React.useState(false);

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{formatIsoDate(selected, titleFormat)}</h1>
        <div className="flex gap-0.5">
          <Link href={prevHref} scroll={false} aria-label="Previous" className={buttonVariants({ variant: "ghost", size: "icon" })}>
            <ChevronLeft className="size-4" />
          </Link>
          <Link href={nextHref} scroll={false} aria-label="Next" className={buttonVariants({ variant: "ghost", size: "icon" })}>
            <ChevronRight className="size-4" />
          </Link>
        </div>
        <Link href={todayHref} scroll={false} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Today
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex gap-1 rounded-control bg-surface-2 p-1">
          {VIEWS.map((v) => (
            <Link
              key={v.value}
              href={buildUrl(pathname, { view: v.value === "month" ? undefined : v.value, date: selected })}
              scroll={false}
              aria-current={view === v.value ? "page" : undefined}
              className={cn("min-h-9 rounded-[0.4rem] px-3 py-1 text-sm transition-colors", view === v.value ? "bg-surface font-medium shadow-sm" : "text-muted hover:text-foreground")}
            >
              {v.label}
            </Link>
          ))}
        </div>
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-4" aria-hidden /> Event
        </Button>
      </div>
      <EventFormDialog open={adding} onOpenChange={setAdding} event={null} defaultDate={selected} clients={clients} />
    </div>
  );
}
