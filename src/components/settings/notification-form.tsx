"use client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/forms/field";
import { useServerForm } from "@/hooks/use-server-form";
import { updateNotificationPrefsAction } from "@/modules/settings/actions";
import { NOTIFICATION_PREFS, type NotificationPrefs } from "@/modules/settings/notification-prefs";
import { notificationPrefsSchema } from "@/modules/settings/schema";
import { SaveBar } from "./save-bar";

export function NotificationForm({ prefs }: { prefs: NotificationPrefs }) {
  const { form, submit, pending, formError } = useServerForm({
    schema: notificationPrefsSchema,
    defaultValues: prefs,
    action: updateNotificationPrefsAction,
    successMessage: "Notification preferences saved",
  });
  const values = form.watch();

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <FormError message={formError} />
      <ul className="divide-y divide-line rounded-card border border-line">
        {NOTIFICATION_PREFS.map(({ key, label, hint }) => (
          <li key={key} className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <Label htmlFor={key}>{label}</Label>
              <p className="text-xs text-muted">{hint}</p>
            </div>
            <Switch id={key} checked={Boolean(values[key])} onCheckedChange={(v) => form.setValue(key, v, { shouldDirty: true })} />
          </li>
        ))}
      </ul>
      <SaveBar pending={pending} dirty={form.formState.isDirty} />
    </form>
  );
}
