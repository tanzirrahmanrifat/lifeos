import * as React from "react";
import { Button } from "@/components/ui/button";

/** Consistent modal footer: destructive action on the left, Cancel + Save on the right. */
export function FormFooter({
  pending,
  onCancel,
  submitLabel,
  left,
}: {
  pending: boolean;
  onCancel: () => void;
  submitLabel: string;
  left?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
      <div>{left}</div>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
