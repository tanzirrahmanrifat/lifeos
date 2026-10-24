import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PHASE_NAMES } from "@/components/ui/phase-placeholder";
import { cn } from "@/lib/utils";

/** Dashboard tile that will show live data once its module exists; until then it says what's coming. */
export function PendingWidget({
  title,
  icon,
  phase,
  message,
  className,
}: {
  title: string;
  icon: LucideIcon;
  phase: number;
  message: string;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <Badge>Phase {phase}</Badge>
      </CardHeader>
      <EmptyState icon={icon} title={`Arrives with ${PHASE_NAMES[phase]}`} description={message} className="flex-1 py-10" />
    </Card>
  );
}
