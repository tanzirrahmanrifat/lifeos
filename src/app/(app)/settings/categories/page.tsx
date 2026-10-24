import type { Metadata } from "next";
import { CategoriesManager } from "@/components/settings/categories-manager";
import { requireUserOrRedirect } from "@/lib/auth/require-user";
import { listCategories } from "@/modules/settings/service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Categories" };

export default async function Page() {
  const user = await requireUserOrRedirect();
  const categories = await listCategories({ userId: user.id });
  return (
    <Card>
      <CardHeader><div><CardTitle>Categories</CardTitle><CardDescription>Create the categories that match how you work and spend.</CardDescription></div></CardHeader>
      <CardContent><CategoriesManager categories={categories} /></CardContent>
    </Card>
  );
}
