import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { TaskList } from "@/components/tasks/task-list";
import { ProjectDetailActions } from "@/components/projects/project-detail-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress";
import { requireUserOrRedirect } from "@/lib/auth/require-user";
import { formatIsoDate } from "@/lib/dates";
import { formatMoney, Money } from "@/lib/money";
import { listClientOptions } from "@/modules/clients/service";
import { getProject } from "@/modules/projects/service";
import { getBundle } from "@/modules/settings/server";
import { listCategoriesOfType } from "@/modules/settings/service";
import { getClock } from "@/modules/shared/clock";
import { forUser } from "@/lib/db/tenant";

export const metadata: Metadata = { title: "Project" };

const STATUS_TONE = { PLANNING: "neutral", ACTIVE: "info", ON_HOLD: "warning", COMPLETED: "success", CANCELLED: "neutral" } as const;
const STATUS_LABEL = { PLANNING: "Planning", ACTIVE: "Active", ON_HOLD: "On hold", COMPLETED: "Completed", CANCELLED: "Cancelled" } as const;

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUserOrRedirect();
  const ctx = { userId: user.id };
  const [clock, bundle, clients] = await Promise.all([getClock(user.id), getBundle(), listClientOptions(ctx)]);
  const project = await getProject(ctx, id, clock.today);
  if (!project) notFound();

  const [taskCats, tasks] = await Promise.all([
    listCategoriesOfType(ctx, "TASK"),
    forUser(ctx.userId).task.findMany({ where: { projectId: id, deletedAt: null }, orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }], include: { category: { select: { name: true, color: true } }, tags: { select: { tag: { select: { name: true } } } }, subtasks: { orderBy: { position: "asc" }, select: { id: true, title: true, done: true } } } }),
  ]);
  const { toTaskDTO } = await import("@/modules/tasks/service");
  const taskDTOs = tasks.map((t) => toTaskDTO(t, clock.today));

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/projects" className="mb-4 inline-flex min-h-10 items-center gap-1 text-sm text-muted hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> All projects
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{project.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone={project.overdue ? "danger" : STATUS_TONE[project.status]}>{project.overdue ? "Overdue" : STATUS_LABEL[project.status]}</Badge>
            <Link href={`/clients/${project.clientId}`} className="text-sm text-primary hover:underline">
              {project.clientName}
            </Link>
          </div>
        </div>
        <ProjectDetailActions project={project} clients={clients} currency={project.budget?.currency ?? bundle.settings.baseCurrency} />
      </header>
      {project.description && <p className="-mt-2 mb-6 text-sm text-muted">{project.description}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted">Revenue</p>
          <p className="tabular mt-1 text-lg font-semibold text-success">{formatMoney(Money.fromDTO(project.revenue))}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Expenses</p>
          <p className="tabular mt-1 text-lg font-semibold text-danger">{formatMoney(Money.fromDTO(project.expenses))}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Budget</p>
          <p className="tabular mt-1 text-lg font-semibold">{project.budget ? formatMoney(Money.fromDTO(project.budget)) : "—"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Deadline</p>
          <p className="mt-1 text-lg font-semibold">{project.deadline ? formatIsoDate(project.deadline, bundle.settings.dateFormat) : "—"}</p>
        </Card>
      </div>

      <Card className="mt-4 p-5">
        <div className="mb-1.5 flex justify-between text-sm">
          <span className="text-muted">Progress</span>
          <span className="tabular font-medium">{project.progress}%</span>
        </div>
        <ProgressBar value={project.progress} label="Project progress" className="h-2.5" />
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
          <NewTaskButton categories={taskCats} defaultProjectId={project.id} size="sm" variant="outline" />
        </CardHeader>
        <CardContent className="pt-0">{taskDTOs.length === 0 ? <EmptyState title="No tasks yet" description="Add tasks for this project from the Tasks page." className="py-6" /> : <TaskList tasks={taskDTOs} categories={taskCats} today={clock.today} dateFormat={bundle.settings.dateFormat} />}</CardContent>
      </Card>

      {project.notes && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm whitespace-pre-wrap text-muted">{project.notes}</CardContent>
        </Card>
      )}
    </div>
  );
}
