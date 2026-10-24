"use client";
import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { archiveHabitAction } from "@/modules/habits/actions";
import type { HabitDTO } from "@/modules/habits/types";
import { HabitFormDialog } from "./habit-form-dialog";
import { useTodayToggle } from "./habit-card";
import { CheckButton } from "@/components/ui/check-button";

export function HabitDetailActions({ habit, categories, today }: { habit: HabitDTO; categories: { id: string; name: string }[]; today: string }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const { done, toggle } = useTodayToggle(habit, today);
  const canCheck = !habit.archived && habit.startDate <= today && (habit.endDate === null || habit.endDate >= today);

  const archive = () =>
    startTransition(async () => {
      const res = await archiveHabitAction({ id: habit.id, archived: !habit.archived });
      if (res.ok) toast.success(habit.archived ? "Habit restored" : "Habit archived — history kept");
      else toast.error(res.error.message);
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canCheck && (
        <Button variant={done ? "secondary" : "primary"} onClick={toggle} className="gap-1">
          <CheckButton checked={done} onToggle={() => undefined} label="" className="pointer-events-none -my-2 -ml-3 scale-75" color={done ? habit.color : undefined} />
          {done ? "Done today" : "Mark done today"}
        </Button>
      )}
      <Button variant="outline" onClick={() => setEditing(true)}>
        <Pencil className="size-4" aria-hidden /> Edit
      </Button>
      <Button variant="ghost" onClick={archive} loading={pending}>
        {habit.archived ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
        {habit.archived ? "Restore" : "Archive"}
      </Button>
      <HabitFormDialog open={editing} onOpenChange={setEditing} habit={habit} categories={categories} today={today} onDeleted={() => router.replace("/habits")} />
    </div>
  );
}
