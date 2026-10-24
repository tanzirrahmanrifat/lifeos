"use client";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { GoalFormDialog } from "./goal-form-dialog";
import type { GoalDTO } from "@/modules/goals/types";

export function GoalDetailActions({ goal, categories }: { goal: GoalDTO; categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setEditing(true)}>
        <Pencil className="size-4" aria-hidden /> Edit
      </Button>
      <GoalFormDialog open={editing} onOpenChange={setEditing} goal={goal} categories={categories} onDeleted={() => router.replace("/goals")} />
    </>
  );
}
