"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { OptionSelect } from "@/components/forms/selects";
import { Input } from "@/components/ui/input";
import { buildUrl } from "@/lib/search-params";
import { REPORT_RANGES, type ReportRangeKey } from "@/modules/reports/date-ranges";

const LABEL: Record<ReportRangeKey, string> = { today: "Today", this_week: "This week", this_month: "This month", last_month: "Last month", this_year: "This year", custom: "Custom range" };

export function RangePicker({ range }: { range: ReportRangeKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const go = (patch: Record<string, string | undefined>) => {
    const next: Record<string, string | undefined> = Object.fromEntries(params.entries());
    for (const [k, v] of Object.entries(patch)) next[k] = v || undefined;
    router.replace(buildUrl(pathname, next), { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <OptionSelect aria-label="Date range" className="w-auto" value={range} onChange={(e) => go({ range: e.target.value })} options={REPORT_RANGES.map((r) => ({ value: r, label: LABEL[r] }))} />
      {range === "custom" && (
        <>
          <Input type="date" aria-label="From" className="w-auto" defaultValue={params.get("from") ?? ""} onChange={(e) => go({ from: e.target.value })} />
          <span className="text-sm text-muted">to</span>
          <Input type="date" aria-label="To" className="w-auto" defaultValue={params.get("to") ?? ""} onChange={(e) => go({ to: e.target.value })} />
        </>
      )}
    </div>
  );
}
