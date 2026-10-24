export const NOTIFICATION_PREFS = [
  { key: "taskOverdue", label: "Overdue tasks", hint: "When a task passes its due date." },
  { key: "taskUpcoming", label: "Upcoming tasks", hint: "The day before a task is due." },
  { key: "invoiceDueSoon", label: "Invoices due soon", hint: "A few days before an invoice is due." },
  { key: "invoiceOverdue", label: "Overdue invoices", hint: "When an invoice passes its due date unpaid." },
  { key: "goalDeadline", label: "Goal deadlines", hint: "As a goal's target date approaches." },
  { key: "habitReminder", label: "Habit reminders", hint: "At each habit's reminder time." },
  { key: "budgetExceeded", label: "Budget exceeded", hint: "When spending passes a category budget." },
] as const;

export type NotificationPrefKey = (typeof NOTIFICATION_PREFS)[number]["key"];
export type NotificationPrefs = Record<NotificationPrefKey, boolean>;

/** Missing keys default to on, so new notification types are opt-out. */
export function resolveNotificationPrefs(stored: unknown): NotificationPrefs {
  const obj = stored && typeof stored === "object" ? (stored as Record<string, unknown>) : {};
  return Object.fromEntries(NOTIFICATION_PREFS.map(({ key }) => [key, obj[key] !== false])) as NotificationPrefs;
}
