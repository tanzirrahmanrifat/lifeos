"use client";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { formatIsoDate } from "@/lib/dates";
import { formatMoney, Money } from "@/lib/money";
import type { ProjectDTO } from "@/modules/projects/types";

const STATUS_TONE = { PLANNING: "neutral", ACTIVE: "info", ON_HOLD: "warning", COMPLETED: "success", CANCELLED: "neutral" } as const;
const STATUS_LABEL = { PLANNING: "Planning", ACTIVE: "Active", ON_HOLD: "On hold", COMPLETED: "Completed", CANCELLED: "Cancelled" } as const;

export function ProjectCard({ project, dateFormat }: { project: ProjectDTO; dateFormat: string }) {
  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="flex h-full flex-col p-4 transition-shadow hover:shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{project.name}</p>
            <p className="truncate text-xs text-muted">{project.clientName}</p>
          </div>
          <Badge tone={project.overdue ? "danger" : STATUS_TONE[project.status]}>{project.overdue ? "Overdue" : STATUS_LABEL[project.status]}</Badge>
        </div>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span>Progress</span>
            <span className="tabular">{project.progress}%</span>
          </div>
          <ProgressBar value={project.progress} label={`${project.name} progress`} />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted">
          <span>{project.deadline ? formatIsoDate(project.deadline, dateFormat) : "No deadline"}</span>
          <span className="tabular font-medium text-success">{formatMoney(Money.fromDTO(project.revenue))}</span>
        </div>
      </Card>
    </Link>
  );
}
