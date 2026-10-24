"use client";
import { Menu, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Brand } from "./brand";
import { ALL_NAV_ITEMS, BOTTOM_NAV } from "./nav";
import { NavLinks } from "./nav-links";

/** Drawer with the full navigation. Opened from the top bar and from "More" in the bottom bar. */
export function MobileDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const pathname = usePathname();
  // Close after navigating.
  React.useEffect(() => onOpenChange(false), [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <DialogTitle className="sr-only">Navigation</DialogTitle>
        <DialogDescription className="sr-only">Move between sections of the app</DialogDescription>
        <div className="px-4 pb-2 pt-5">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavLinks onNavigate={() => onOpenChange(false)} />
        </div>
        <div className="border-t border-line p-3">
          <Link
            href="/settings/profile"
            className="flex min-h-11 items-center gap-3 rounded-control px-3 text-sm text-muted hover:bg-surface-2 hover:text-foreground"
          >
            <Settings className="size-[18px]" aria-hidden /> Settings
          </Link>
        </div>
      </SheetContent>
    </Dialog>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" className="md:hidden" onClick={onClick} aria-label="Open navigation">
      <Menu className="size-5" aria-hidden />
    </Button>
  );
}

/** Thumb-reach navigation for phones: four core sections plus "More" for everything else. */
export function BottomNav({ onMore }: { onMore: () => void }) {
  const pathname = usePathname();
  const items = BOTTOM_NAV.map((href) => ALL_NAV_ITEMS.find((i) => i.href === href)!).filter(Boolean);
  const cell = "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors";

  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn(cell, active ? "text-primary" : "text-muted")}>
            <item.icon className="size-5" aria-hidden />
            {item.label}
          </Link>
        );
      })}
      <button type="button" onClick={onMore} className={cn(cell, "text-muted")}>
        <Menu className="size-5" aria-hidden />
        More
      </button>
    </nav>
  );
}
