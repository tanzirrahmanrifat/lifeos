"use client";
import { X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { OptionSelect } from "@/components/forms/selects";
import { SearchBox } from "@/components/ui/search-box";
import { buildUrl } from "@/lib/search-params";
import { INVOICE_STATUSES } from "@/modules/invoices/schema";
import { STATUS_LABEL } from "./invoice-meta";

export function InvoicesToolbar({ clients }: { clients: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const go = (patch: Record<string, string | undefined>) => {
    const next: Record<string, string | undefined> = Object.fromEntries(params.entries());
    delete next.page;
    for (const [k, v] of Object.entries(patch)) next[k] = v || undefined;
    router.replace(buildUrl(pathname, next), { scroll: false });
  };

  const active = params.get("status") || params.get("clientId") || params.get("q");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchBox paramKey="q" placeholder="Search invoice number or client" />
      <OptionSelect aria-label="Status" className="w-auto" value={params.get("status") ?? ""} onChange={(e) => go({ status: e.target.value })} emptyLabel="Any status" options={INVOICE_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
      <OptionSelect aria-label="Client" className="w-auto max-w-44" value={params.get("clientId") ?? ""} onChange={(e) => go({ clientId: e.target.value })} emptyLabel="Any client" options={clients.map((c) => ({ value: c.id, label: c.name }))} />
      {active && (
        <button type="button" onClick={() => router.replace(pathname, { scroll: false })} className="inline-flex min-h-10 items-center gap-1 rounded-control px-2 text-sm text-muted hover:text-foreground">
          <X className="size-4" aria-hidden /> Clear
        </button>
      )}
    </div>
  );
}
