"use client";
import { Search as SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { globalSearchAction } from "@/modules/search/actions";
import type { SearchGroup, SearchResult } from "@/modules/search/types";
import { cn } from "@/lib/utils";

/** ⌘K / Ctrl+K opens the palette from anywhere in the app; the search icon in the top bar does too. */
export function GlobalSearch() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Search (⌘K)" onClick={() => setOpen(true)}>
        <SearchIcon className="size-[18px]" aria-hidden />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[15%] max-w-xl translate-y-0 p-0" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Search</DialogTitle>
          <DialogDescription className="sr-only">Search across tasks, clients, projects, invoices and more</DialogDescription>
          {/* Mounted only while open, so every search stat resets naturally on close — no reset effect needed. */}
          {open && <SearchPalette onNavigate={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function SearchPalette({ onNavigate }: { onNavigate: () => void }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [groups, setGroups] = React.useState<SearchGroup[]>([]);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [pending, startTransition] = React.useTransition();
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  React.useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => {
      startTransition(async () => {
        const res = await globalSearchAction(q);
        setActiveIndex(0);
        if (res.ok) setGroups(res.data as SearchGroup[]);
      });
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const groupsForQuery = q.trim().length < 2 ? [] : groups;
  const flat = groupsForQuery.flatMap((g) => g.results);

  const go = (r: SearchResult) => {
    onNavigate();
    router.push(r.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && flat[activeIndex]) {
      e.preventDefault();
      go(flat[activeIndex]!);
    }
  };

  let runningIndex = -1;

  return (
    <>
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <SearchIcon className="size-4 shrink-0 text-muted" aria-hidden />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search tasks, clients, invoices, notes…"
          aria-label="Search"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
        />
        <kbd className="hidden rounded border border-line px-1.5 py-0.5 text-[10px] text-muted sm:block">Esc</kbd>
      </div>
      <div className="max-h-[60vh] overflow-y-auto p-2">
        {q.trim().length < 2 && <p className="px-3 py-6 text-center text-sm text-muted">Type at least 2 characters to search.</p>}
        {q.trim().length >= 2 && !pending && groupsForQuery.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted">No results for &ldquo;{q}&rdquo;.</p>}
        {groupsForQuery.map((group) => (
          <div key={group.kind} className="mb-2">
            <p className="px-3 py-1 text-xs font-medium text-muted">{group.label}</p>
            <ul>
              {group.results.map((r) => {
                runningIndex++;
                const idx = runningIndex;
                return (
                  <li key={`${r.kind}-${r.id}`}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => go(r)}
                      className={cn("flex w-full min-w-0 items-center gap-2 rounded-control px-3 py-2 text-left text-sm", idx === activeIndex ? "bg-primary-soft text-primary" : "hover:bg-surface-2")}
                    >
                      <span className="min-w-0 flex-1 truncate">{r.title}</span>
                      {r.subtitle && <span className="shrink-0 truncate text-xs text-muted">{r.subtitle}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
