import type { Metadata } from "next";
import { InvoiceSettingsForm } from "@/components/settings/invoice-settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBundle } from "@/modules/settings/server";

export const metadata: Metadata = { title: "Invoice settings" };

export default async function Page() {
  const { settings } = await getBundle();
  return (
    <Card>
      <CardHeader><div><CardTitle>Numbering and defaults</CardTitle><CardDescription>Applied to every new invoice. You can override them on each invoice.</CardDescription></div></CardHeader>
      <CardContent><InvoiceSettingsForm settings={settings} /></CardContent>
    </Card>
  );
}
