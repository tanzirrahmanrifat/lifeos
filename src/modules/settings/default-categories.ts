import type { CategoryType } from "@/generated/prisma/enums";

export interface DefaultCategory {
  type: CategoryType;
  name: string;
  color: string;
  isSystem?: boolean;
}

/** Starter categories created for every new account. All are editable except system ones. */
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // Income
  { type: "INCOME", name: "Client payment", color: "#0e6b5c", isSystem: true }, // used by invoice payments
  { type: "INCOME", name: "Salary", color: "#2b5fb4" },
  { type: "INCOME", name: "Investment", color: "#7a4fb5" },
  { type: "INCOME", name: "Gift", color: "#b7791f" },
  { type: "INCOME", name: "Other income", color: "#64748b" },
  // Expense
  { type: "EXPENSE", name: "Food", color: "#c2410c" },
  { type: "EXPENSE", name: "Transportation", color: "#2b5fb4" },
  { type: "EXPENSE", name: "Rent", color: "#7a4fb5" },
  { type: "EXPENSE", name: "Utilities", color: "#0e7490" },
  { type: "EXPENSE", name: "Software", color: "#0e6b5c" },
  { type: "EXPENSE", name: "Business", color: "#b7791f" },
  { type: "EXPENSE", name: "Entertainment", color: "#be185d" },
  { type: "EXPENSE", name: "Shopping", color: "#a16207" },
  { type: "EXPENSE", name: "Education", color: "#4d7c0f" },
  { type: "EXPENSE", name: "Donations", color: "#15803d", isSystem: true }, // used by donations paid from an account
  { type: "EXPENSE", name: "Other", color: "#64748b" },
  // Task
  { type: "TASK", name: "Personal", color: "#7a4fb5" },
  { type: "TASK", name: "Work", color: "#2b5fb4" },
  { type: "TASK", name: "Home", color: "#b7791f" },
  { type: "TASK", name: "Learning", color: "#4d7c0f" },
  { type: "TASK", name: "Admin", color: "#64748b" },
  // Goal
  { type: "GOAL", name: "Personal", color: "#7a4fb5" },
  { type: "GOAL", name: "Business", color: "#2b5fb4" },
  { type: "GOAL", name: "Financial", color: "#0e6b5c" },
  { type: "GOAL", name: "Health", color: "#c2410c" },
  { type: "GOAL", name: "Education", color: "#4d7c0f" },
  { type: "GOAL", name: "Other", color: "#64748b" },
  // Habit
  { type: "HABIT", name: "Health", color: "#c2410c" },
  { type: "HABIT", name: "Mind", color: "#7a4fb5" },
  { type: "HABIT", name: "Learning", color: "#4d7c0f" },
  { type: "HABIT", name: "Productivity", color: "#2b5fb4" },
  { type: "HABIT", name: "Routine", color: "#b7791f" },
  // Note
  { type: "NOTE", name: "General", color: "#64748b" },
  { type: "NOTE", name: "Ideas", color: "#b7791f" },
  { type: "NOTE", name: "Meetings", color: "#2b5fb4" },
  { type: "NOTE", name: "Reference", color: "#0e7490" },
  // Donation (দান)
  { type: "DONATION", name: "Sadaqah (সাদাকাহ)", color: "#15803d" },
  { type: "DONATION", name: "Zakat (যাকাত)", color: "#0e6b5c" },
  { type: "DONATION", name: "Fitra (ফিতরা)", color: "#b7791f" },
  { type: "DONATION", name: "Mosque / Madrasa", color: "#2b5fb4" },
  { type: "DONATION", name: "Family & relatives", color: "#7a4fb5" },
  { type: "DONATION", name: "Other", color: "#64748b" },
];

/** Expense category that donations paid from an account are booked under. */
export const CHARITY_EXPENSE_CATEGORY = { name: "Donations", color: "#15803d" } as const;
