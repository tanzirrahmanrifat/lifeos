"use client";
import * as React from "react";
import { toast } from "sonner";
import { CheckButton } from "@/components/ui/check-button";
import { toggleHabitAction } from "@/modules/habits/actions";

export function HabitCheckLink({ habitId, today, initialDone, color, label }: { habitId: string; today: string; initialDone: boolean; color: string; label: string }) {
  const [done, setDone] = React.useState(initialDone);
  const [, startTransition] = React.useTransition();
  const toggle = () => {
    const next = !done;
    setDone(next);
    startTransition(async () => {
      const res = await toggleHabitAction({ habitId, date: today });
      if (!res.ok) {
        setDone(!next);
        toast.error(res.error.message);
      }
    });
  };
  return <CheckButton checked={done} onToggle={toggle} color={color} label={done ? `Undo ${label}` : `Mark ${label} done`} className="size-9" />;
}
