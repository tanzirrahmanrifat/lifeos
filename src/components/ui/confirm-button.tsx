"use client";
import * as React from "react";
import { Button, type ButtonProps } from "./button";

/** Two-step destructive action without a second dialog: first click arms it, second confirms. */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = "Click again to confirm",
  loading,
  ...props
}: Omit<ButtonProps, "onClick"> & { onConfirm: () => void; confirmLabel?: string }) {
  const [armed, setArmed] = React.useState(false);
  React.useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button
      type="button"
      {...props}
      variant={armed ? "danger" : (props.variant ?? "ghost")}
      loading={loading}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
    >
      {armed ? confirmLabel : children}
    </Button>
  );
}
