"use client";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import type { ProjectDTO } from "@/modules/projects/types";
import { ProjectFormDialog } from "./project-form-dialog";

export function ProjectDetailActions({ project, clients, currency }: { project: ProjectDTO; clients: { id: string; name: string }[]; currency: string }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setEditing(true)}>
        <Pencil className="size-4" aria-hidden /> Edit
      </Button>
      <ProjectFormDialog open={editing} onOpenChange={setEditing} project={project} clients={clients} currency={currency} onDeleted={() => router.replace("/projects")} />
    </>
  );
}
