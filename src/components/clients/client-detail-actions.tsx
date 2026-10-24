"use client";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import type { ClientDTO } from "@/modules/clients/types";
import { ClientFormDialog } from "./client-form-dialog";

export function ClientDetailActions({ client }: { client: ClientDTO }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setEditing(true)}>
        <Pencil className="size-4" aria-hidden /> Edit
      </Button>
      <ClientFormDialog open={editing} onOpenChange={setEditing} client={client} onDeleted={() => router.replace("/clients")} />
    </>
  );
}
