import type { Metadata } from "next";
import { NotificationForm } from "@/components/settings/notification-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBundle } from "@/modules/settings/server";

export const metadata: Metadata = { title: "Notifications" };

export default async function Page() {
  const { settings } = await getBundle();
  return (
    <Card>
      <CardHeader><div><CardTitle>What should we tell you about?</CardTitle><CardDescription>In-app notifications switch on with their modules; your choices here are saved now.</CardDescription></div></CardHeader>
      <CardContent><NotificationForm prefs={settings.notificationPrefs} /></CardContent>
    </Card>
  );
}
