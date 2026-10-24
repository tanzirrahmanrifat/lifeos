"use client";
import * as React from "react";
import { Brand } from "./brand";
import { BottomNav, MobileDrawer, MobileMenuButton } from "./mobile-nav";
import { GlobalSearch } from "@/components/search/global-search";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

/**
 * Responsive frame. Desktop: fixed sidebar + sticky top bar. Phone: top bar with drawer button,
 * bottom navigation for the four core sections, and safe-area padding for notched devices.
 * The sidebar itself is a server component passed in as `sidebar`.
 */
export function AppShell({
  sidebar,
  user,
  children,
}: {
  sidebar: React.ReactNode;
  user: { name: string; email: string };
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-control bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      {sidebar}
      <MobileDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />

      <div className="md:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-background/90 px-3 pt-[env(safe-area-inset-top)] backdrop-blur md:h-16 md:px-8">
          <MobileMenuButton onClick={() => setDrawerOpen(true)} />
          <div className="md:hidden">
            <Brand />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <GlobalSearch />
            <ThemeToggle />
            <UserMenu name={user.name} email={user.email} />
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-7xl px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8">
          {children}
        </main>
      </div>

      <BottomNav onMore={() => setDrawerOpen(true)} />
    </div>
  );
}
