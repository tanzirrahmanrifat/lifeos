import type { Metadata } from "next";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBundle } from "@/modules/settings/server";

export const metadata: Metadata = { title: "Preferences" };

export default async function Page() {
  const { settings } = await getBundle();
  return (
    <Card>
      <CardHeader><div><CardTitle>Appearance and regional</CardTitle><CardDescription>Theme, currency, dates and the first day of your week.</CardDescription></div></CardHeader>
      <CardContent><PreferencesForm settings={settings} /></CardContent>
    </Card>
  );
}
