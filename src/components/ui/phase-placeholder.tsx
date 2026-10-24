import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const PHASE_NAMES: Record<number, string> = {
  2: "Productivity",
  3: "Finance",
  4: "Business",
  6: "Reports",
};

/**
 * Honest placeholder for a module that hasn't shipped yet: says which phase delivers it and what
 * it will contain, with no fake buttons.
 */
export function ComingSoon({
  title,
  description,
  phase,
  icon,
  features,
}: {
  title: string;
  description: string;
  phase: number;
  icon: LucideIcon;
  features: string[];
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card>
        <EmptyState
          icon={icon}
          title={`${title} arrive${title.endsWith("s") ? "" : "s"} in Phase ${phase} — ${PHASE_NAMES[phase]}`}
          description="This section is planned and its data model already exists. It will be fully functional when its phase is delivered."
        />
        <ul className="mx-auto mb-8 grid max-w-xl gap-x-8 gap-y-2 px-6 text-sm text-muted sm:grid-cols-2">
          {features.map((f) => (
            <li key={f} className="flex gap-2">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60" />
              {f}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
