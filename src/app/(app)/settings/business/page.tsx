import type { Metadata } from "next";
import { BusinessForm } from "@/components/settings/business-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBundle } from "@/modules/settings/server";

export const metadata: Metadata = { title: "Business" };

export default async function Page() {
  const { business } = await getBundle();
  return (
    <Card>
      <CardHeader><div><CardTitle>Business details</CardTitle><CardDescription>Printed on your invoices.</CardDescription></div></CardHeader>
      <CardContent><BusinessForm business={business} /></CardContent>
    </Card>
  );
}
