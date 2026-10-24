"use client";
import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { OptionSelect } from "@/components/forms/selects";
import { Input } from "@/components/ui/input";
import { buildUrl } from "@/lib/search-params";

interface Option {
  id: string;
  name: string;
}

export function FinanceToolbar({ accounts, categories }: { accounts: Option[]; categories: Option[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = React.useState(params.get("q") ?? "");

  const go = React.useCallback(
    (patch: Record<string, string | undefined>) => {
      const next: Record<string, string | undefined> = Object.fromEntries(params.entries());
      delete next.page;
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

  const active = ["q", "type", "accountId", "categoryId"].some((k) => params.get(k));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1 basis-56">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search transactions" aria-label="Search transactions" className="pl-9" />
      </div>
      <OptionSelect
        aria-label="Type"
        className="w-auto"
        value={params.get("type") ?? ""}
        onChange={(e) => go({ type: e.target.value })}
        emptyLabel="Income & expense"
        options={[
          { value: "INCOME", label: "Income" },
          { value: "EXPENSE", label: "Expense" },
        ]}
      />
      <OptionSelect aria-label="Account" className="w-auto max-w-44" value={params.get("accountId") ?? ""} onChange={(e) => go({ accountId: e.target.value })} emptyLabel="Any account" options={accounts.map((a) => ({ value: a.id, label: a.name }))} />
      <OptionSelect aria-label="Category" className="w-auto max-w-44" value={params.get("categoryId") ?? ""} onChange={(e) => go({ categoryId: e.target.value })} emptyLabel="Any category" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
      {active && (
        <button type="button" onClick={() => { setQ(""); router.replace(pathname, { scroll: false }); }} className="inline-flex min-h-10 items-center gap-1 rounded-control px-2 text-sm text-muted hover:text-foreground">
          <X className="size-4" aria-hidden /> Clear
        </button>
      )}
    </div>
  );
}
