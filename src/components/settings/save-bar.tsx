import { Button } from "@/components/ui/button";

/** Consistent form footer: primary save button, disabled until something changed. */
export function SaveBar({ pending, dirty, label = "Save changes" }: { pending: boolean; dirty: boolean; label?: string }) {
  return (
    <div className="flex items-center justify-end gap-3 border-t border-line pt-5">
      {!dirty && !pending && <span className="text-xs text-muted">No unsaved changes</span>}
      <Button type="submit" loading={pending} disabled={!dirty}>
        {label}
      </Button>
    </div>
  );
}
