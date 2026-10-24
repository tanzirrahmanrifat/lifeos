"use client";
import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./sheet";
import { cn } from "@/lib/utils";

/** Standard form modal: title, optional description, scrollable body. Every quick-add form uses this. */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-2xl", className)} aria-describedby={description ? undefined : undefined}>
        <DialogTitle className="pr-8 text-lg font-semibold tracking-tight">{title}</DialogTitle>
        {description ? <DialogDescription className="mt-1 text-sm text-muted">{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
        <div className="mt-5">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
