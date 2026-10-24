import { CalendarClock, CheckSquare, FileText, Flag, FolderKanban, Milestone, type LucideIcon } from "lucide-react";
import type { CalendarItemKind } from "@/modules/calendar/types";

const MAP: Record<CalendarItemKind, LucideIcon> = { task: CheckSquare, event: CalendarClock, goal: Flag, milestone: Milestone, invoice: FileText, project: FolderKanban };
export function ItemIcon({ kind, className }: { kind: CalendarItemKind; className?: string }) {
  const Icon = MAP[kind];
  return <Icon className={className} aria-hidden />;
}
