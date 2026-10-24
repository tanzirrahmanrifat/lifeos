"use client";
import Link from "next/link";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { formatIsoDate } from "@/lib/dates";
import type { ProjectDTO } from "@/modules/projects/types";

const STATUS_TONE = { PLANNING: "neutral", ACTIVE: "info", ON_HOLD: "warning", COMPLETED: "success", CANCELLED: "neutral" } as const;
const STATUS_LABEL = { PLANNING: "Planning", ACTIVE: "Active", ON_HOLD: "On hold", COMPLETED: "Completed", CANCELLED: "Cancelled" } as const;

export function ProjectRow({ project, dateFormat }: { project: ProjectDTO; dateFormat: string }) {
  return (
    <li>
      <Link href={`/projects/${project.id}`} className="flex items-center gap-3 py-2.5 hover:bg-surface-2/60">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{project.name}</p>
          <p className="text-xs text-muted">{project.deadline ? formatIsoDate(project.deadline, dateFormat) : "No deadline"}</p>
        </div>
        <div className="w-20">
          <ProgressBar value={project.progress} label={`${project.name} progress`} />
        </div>
        <Badge tone={project.overdue ? "danger" : STATUS_TONE[project.status]}>{project.overdue ? "Overdue" : STATUS_LABEL[project.status]}</Badge>
      </Link>
    </li>
  );
}
