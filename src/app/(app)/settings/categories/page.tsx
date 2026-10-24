import type { Metadata } from "next";
import { CategoriesManager } from "@/components/settings/categories-manager";
import { requireUserOrRedirect } from "@/lib/auth/require-user";
import { listCategories, listCategoriesOfType } from "@/modules/settings/service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Categories" };

export default async function Page() {
  const user = await requireUserOrRedirect();
  // Accounts created before donations existed get the starter donation categories on first visit.
  await listCategoriesOfType({ userId: user.id }, "DONATION");
  const categories = await listCategories({ userId: user.id });
  return (
    <Card>
      <CardHeader><div><CardTitle>Categories</CardTitle><CardDescription>Create the categories that match how you work and spend.</CardDescription></div></CardHeader>
      <CardContent><CategoriesManager categories={categories} /></CardContent>
    </Card>
  );
}
