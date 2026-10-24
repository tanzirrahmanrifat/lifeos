import type { Metadata } from "next";
import { CheckCircle2, ClipboardList, Clock, PartyPopper, SearchX } from "lucide-react";
import Link from "next/link";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { TaskList } from "@/components/tasks/task-list";
import { TasksToolbar } from "@/components/tasks/tasks-toolbar";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SegmentedLinks } from "@/components/ui/segmented";
import { requireUserOrRedirect } from "@/lib/auth/require-user";
import { buildUrl, first, type RawSearchParams } from "@/lib/search-params";
import { getBundle } from "@/modules/settings/server";
import { listCategoriesOfType } from "@/modules/settings/service";
import { getClock } from "@/modules/shared/clock";
import { taskListQuerySchema } from "@/modules/tasks/schema";
import { getTask, listTasks } from "@/modules/tasks/service";

export const metadata: Metadata = { title: "Tasks" };

const VIEW_COPY = {
  today: { icon: PartyPopper, title: "Nothing due today", text: "A clear day. Add something, or enjoy it." },
  upcoming: { icon: Clock, title: "Nothing coming up", text: "Tasks with a future due date show up here." },
  overdue: { icon: CheckCircle2, title: "You're all caught up", text: "No overdue tasks. Nice." },
  completed: { icon: CheckCircle2, title: "No completed tasks yet", text: "Tick a task off and it will land here." },
  all: { icon: ClipboardList, title: "No tasks yet", text: "Add your first task to start planning your day." },
} as const;

export default async function TasksPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const user = await requireUserOrRedirect();
  const ctx = { userId: user.id };
  const [clock, bundle] = await Promise.all([getClock(user.id), getBundle()]);

  const query = taskListQuerySchema.parse({
    view: first(sp.view),
    status: first(sp.status),
    priority: first(sp.priority),
    categoryId: first(sp.categoryId),
    q: first(sp.q),
    sort: first(sp.sort),
    page: first(sp.page),
  });

  const editId = first(sp.edit);
  const [result, categories, initialEdit] = await Promise.all([
    listTasks(ctx, query, clock.today),
    listCategoriesOfType(ctx, "TASK"),
    editId ? getTask(ctx, editId, clock.today) : Promise.resolve(null),
  ]);

  const params = { view: query.view === "today" ? undefined : query.view, status: query.status, priority: query.priority, categoryId: query.categoryId, q: query.q, sort: query.sort };
  const href = (patch: Record<string, string | number | undefined>) => buildUrl("/tasks", { ...params, ...patch });
  const filtered = Boolean(query.q || query.status || query.priority || query.categoryId);
  const copy = VIEW_COPY[query.view];
  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }));

  return (
    <>
      <PageHeader title="Tasks" description="Everything you need to do, in one place." actions={<NewTaskButton categories={categoryOptions} defaultDueDate={query.view === "today" ? clock.today : undefined} />} />

      <div className="space-y-4">
        <SegmentedLinks
          label="Task views"
          items={[
            { label: "Today", href: buildUrl("/tasks", {}), active: query.view === "today", count: result.counts.today },
            { label: "Upcoming", href: buildUrl("/tasks", { view: "upcoming" }), active: query.view === "upcoming", count: result.counts.upcoming },
            { label: "Overdue", href: buildUrl("/tasks", { view: "overdue" }), active: query.view === "overdue", count: result.counts.overdue, alert: true },
            { label: "Completed", href: buildUrl("/tasks", { view: "completed" }), active: query.view === "completed" },
            { label: "All", href: buildUrl("/tasks", { view: "all" }), active: query.view === "all" },
          ]}
        />
        <TasksToolbar view={query.view} categories={categoryOptions} />

        {result.items.length === 0 ? (
          <Card>
            {filtered ? (
              <EmptyState
                icon={SearchX}
                title="No tasks match your filters"
                description="Try a different search, or clear the filters."
                action={
                  <Link href={buildUrl("/tasks", { view: params.view })} className={buttonVariants({ variant: "outline" })}>
                    Clear filters
                  </Link>
                }
              />
            ) : (
              <EmptyState icon={copy.icon} title={copy.title} description={copy.text} action={<NewTaskButton categories={categoryOptions} defaultDueDate={query.view === "today" ? clock.today : undefined}>Add your first task</NewTaskButton>} />
            )}
          </Card>
        ) : (
          <TaskList
            tasks={result.items}
            categories={categoryOptions}
            today={clock.today}
            dateFormat={bundle.settings.dateFormat}
            initialEdit={initialEdit}
            closeHref={href({ page: query.page > 1 ? query.page : undefined })}
          />
        )}
        <Pagination page={result.page} pageSize={result.pageSize} total={result.total} hrefFor={(p) => href({ page: p })} />
      </div>
    </>
  );
}
