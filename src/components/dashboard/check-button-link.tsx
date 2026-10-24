"use client";
import * as React from "react";
import { toast } from "sonner";
import { CheckButton } from "@/components/ui/check-button";
import { setTaskStatusAction } from "@/modules/tasks/actions";

/** The dashboard's own optimistic checkbox — no full task object needed, just an id. */
export function CheckButtonLink({ taskId, label }: { taskId: string; label: string }) {
  const [done, setDone] = React.useState(false);
  const [, startTransition] = React.useTransition();
  const toggle = () => {
    const next = !done;
    setDone(next);
    startTransition(async () => {
      const res = await setTaskStatusAction({ id: taskId, status: next ? "COMPLETED" : "TODO" });
      if (!res.ok) {
        setDone(!next);
        toast.error(res.error.message);
      }
    });
  };
  return <CheckButton checked={done} onToggle={toggle} label={done ? `Reopen “${label}”` : `Complete “${label}”`} className="size-9" />;
}
