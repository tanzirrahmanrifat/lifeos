"use client";
import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Input } from "@/components/ui/input";
import { buildUrl } from "@/lib/search-params";

/** A debounced search box that writes its value into the URL's `paramKey` and resets pagination. */
export function SearchBox({ paramKey, placeholder, className }: { paramKey: string; placeholder: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = React.useState(params.get(paramKey) ?? "");

  React.useEffect(() => {
    if ((params.get(paramKey) ?? "") === value.trim()) return;
    const t = setTimeout(() => {
      const next: Record<string, string | undefined> = Object.fromEntries(params.entries());
      next[paramKey] = value.trim() || undefined;
      delete next.page;
      router.replace(buildUrl(pathname, next), { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={className ?? "relative min-w-0 flex-1 basis-56"}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="pl-9" />
    </div>
  );
}
