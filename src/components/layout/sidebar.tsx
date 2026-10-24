import { Settings } from "lucide-react";
import Link from "next/link";
import { Brand } from "./brand";
import { NavLinks } from "./nav-links";

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface md:flex">
      <div className="px-4 pb-2 pt-5">
        <Brand />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <NavLinks />
      </div>
      <div className="border-t border-line p-3">
        <Link
          href="/settings/profile"
          className="flex min-h-10 items-center gap-3 rounded-control px-3 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <Settings className="size-[18px]" aria-hidden />
          Settings
        </Link>
      </div>
    </aside>
  );
}
