"use client";
import { Check } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

/** Large round tick used for tasks, habits and milestones. Big enough for a thumb. */
export function CheckButton({
  checked,
  onToggle,
  label,
  color,
  disabled,
  className,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  /** Fill colour when checked (habits use their own). */
  color?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-full md:size-9",
        "before:grid before:size-6 before:place-items-center before:rounded-full before:border-2 before:transition-colors before:content-['']",
        !checked && "before:border-line hover:before:border-primary",
        disabled && "opacity-60",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute grid size-6 place-items-center rounded-full text-white transition-all",
          checked ? "scale-100 opacity-100" : "scale-50 opacity-0",
        )}
        style={{ background: color ?? "var(--primary)" }}
      >
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    </button>
  );
}
