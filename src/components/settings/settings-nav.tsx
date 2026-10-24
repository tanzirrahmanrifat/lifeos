"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/business", label: "Business" },
  { href: "/settings/invoices", label: "Invoices" },
  { href: "/settings/categories", label: "Categories" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/preferences", label: "Preferences" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings" className="-mx-4 mb-6 overflow-x-auto border-b border-line px-4 md:mx-0 md:px-0">
      <ul className="flex min-w-max gap-1">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-11 items-center px-3 text-sm transition-colors",
                  active ? "font-medium text-foreground after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:bg-primary" : "text-muted hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
