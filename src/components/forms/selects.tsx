"use client";
import * as React from "react";
import { Select } from "@/components/ui/input";

export interface Option {
  value: string;
  label: string;
}

/** A <select> from an options list, with an optional empty choice. Works with react-hook-form's register(). */
export const OptionSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { options: Option[]; emptyLabel?: string }
>(({ options, emptyLabel, ...props }, ref) => (
  <Select ref={ref} {...props}>
    {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
    {options.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </Select>
));
OptionSelect.displayName = "OptionSelect";

export const PRIORITY_OPTIONS: Option[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

export const TASK_STATUS_OPTIONS: Option[] = [
  { value: "TODO", label: "To do" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export const GOAL_STATUS_OPTIONS: Option[] = [
  { value: "NOT_STARTED", label: "Not started" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "ON_HOLD", label: "On hold" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];
