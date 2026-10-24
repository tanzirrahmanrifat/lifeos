"use client";
import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <Card className="mx-auto mt-10 max-w-xl">
      <EmptyState
        icon={TriangleAlert}
        title="This page couldn't load"
        description={`Nothing was lost — your data is safe. Try again, and if it keeps happening note this reference: ${error.digest ?? "none"}.`}
        action={<Button onClick={reset}>Try again</Button>}
      />
    </Card>
  );
}
