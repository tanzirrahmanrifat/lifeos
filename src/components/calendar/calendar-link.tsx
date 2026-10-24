"use client";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { buildUrl } from "@/lib/search-params";

/** Same view, different date/event — used by "+ Add event" and other in-page nav that keeps view state. */
export function CalendarLink({ date, event, label, className }: { date?: string; event?: string; label: string; className?: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const view = params.get("view") ?? undefined;
  return (
    <Link href={buildUrl(pathname, { view, date, event })} scroll={false} className={className ?? "text-sm font-medium text-primary hover:underline"}>
      {label}
    </Link>
  );
}
