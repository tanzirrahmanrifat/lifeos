"use client";
import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { OptionSelect, PRIORITY_OPTIONS, TASK_STATUS_OPTIONS } from "@/components/forms/selects";
import { Input } from "@/components/ui/input";
import { buildUrl } from "@/lib/search-params";

const SORTS = [
  { value: "due", label: "Sort: due date" },
  { value: "priority", label: "Sort: priority" },
  { value: "created", label: "Sort: newest" },
  { value: "title", label: "Sort: title" },
];

/** Filters live in the URL; search is debounced so typing doesn't hammer the server. */
export function TasksToolbar({ view, categories }: { view: string; categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = React.useState(params.get("q") ?? "");

  const go = React.useCallback(
    (patch: Record<string, string | undefined>) => {
      const next: Record<string, string | undefined> = Object.fromEntries(params.entries());
      delete next.page; // any filter change goes back to page 1
      delete next.edit;
      for (const [k, v] of Object.entries(patch)) next[k] = v || undefined;
      router.replace(buildUrl(pathname, next), { scroll: false });
    },
    [params, pathname, router],
  );

  React.useEffect(() => {
    if ((params.get("q") ?? "") === q.trim()) return;
    const t = setTimeout(() => go({ q: q.trim() }), 300);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = ["q", "priority", "categoryId", "status"].some((k) => params.get(k));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1 basis-56">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks" aria-label="Search tasks" className="pl-9" />
      </div>
      <OptionSelect aria-label="Priority" className="w-auto" value={params.get("priority") ?? ""} onChange={(e) => go({ priority: e.target.value })} emptyLabel="Any priority" options={PRIORITY_OPTIONS} />
      <OptionSelect aria-label="Category" className="w-auto max-w-44" value={params.get("categoryId") ?? ""} onChange={(e) => go({ categoryId: e.target.value })} emptyLabel="Any category" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
      {view === "all" && <OptionSelect aria-label="Status" className="w-auto" value={params.get("status") ?? ""} onChange={(e) => go({ status: e.target.value })} emptyLabel="Any status" options={TASK_STATUS_OPTIONS} />}
      <OptionSelect aria-label="Sort" className="w-auto" value={params.get("sort") ?? (view === "completed" ? "created" : "due")} onChange={(e) => go({ sort: e.target.value })} options={SORTS} />
      {active && (
        <button
          type="button"
          onClick={() => {
            setQ("");
            router.replace(buildUrl(pathname, { view: params.get("view") ?? undefined }), { scroll: false });
          }}
          className="inline-flex min-h-10 items-center gap-1 rounded-control px-2 text-sm text-muted hover:text-foreground"
        >
          <X className="size-4" aria-hidden /> Clear
        </button>
      )}
    </div>
  );
}
