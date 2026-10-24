import Link from "next/link";
import { cn } from "@/lib/utils";

export interface SegmentedItem {
  label: string;
  href: string;
  active: boolean;
  count?: number;
  /** Highlights the count (e.g. overdue tasks). */
  alert?: boolean;
}

/** Link-based tabs: the selected view lives in the URL, so it survives reloads and can be shared. */
export function SegmentedLinks({ items, label }: { items: SegmentedItem[]; label: string }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex min-w-max gap-1 rounded-control bg-surface-2 p-1">
        {items.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              scroll={false}
              className={cn(
                "flex min-h-10 items-center gap-2 rounded-[0.5rem] px-3.5 text-sm transition-colors",
                item.active ? "bg-surface font-medium text-foreground shadow-sm" : "text-muted hover:text-foreground",
              )}
            >
              {item.label}
              {item.count !== undefined && item.count > 0 && (
                <span
                  className={cn(
                    "tabular rounded-full px-1.5 text-xs",
                    item.alert ? "bg-danger-soft text-danger" : "bg-surface-2 text-muted",
                    item.active && !item.alert && "bg-primary-soft text-primary",
                  )}
                >
                  {item.count}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
