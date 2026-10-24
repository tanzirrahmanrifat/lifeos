"use client";
import { X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { OptionSelect } from "@/components/forms/selects";
import { SearchBox } from "@/components/ui/search-box";
import { CLIENT_STATUSES } from "@/modules/clients/schema";
import { buildUrl } from "@/lib/search-params";

const STATUS_LABEL: Record<string, string> = { LEAD: "Lead", ACTIVE: "Active", INACTIVE: "Inactive", COMPLETED: "Completed" };

export function ClientsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const status = params.get("status") ?? "";

  const setStatus = (value: string) => {
    const next: Record<string, string | undefined> = Object.fromEntries(params.entries());
    next.status = value || undefined;
    delete next.page;
    router.replace(buildUrl(pathname, next), { scroll: false });
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <SearchBox paramKey="q" placeholder="Search clients" />
      <OptionSelect aria-label="Status" className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)} emptyLabel="Any status" options={CLIENT_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s]! }))} />
      {(status || params.get("q")) && (
        <button type="button" onClick={() => router.replace(pathname, { scroll: false })} className="inline-flex min-h-10 items-center gap-1 rounded-control px-2 text-sm text-muted hover:text-foreground">
          <X className="size-4" aria-hidden /> Clear
        </button>
      )}
    </div>
  );
}
