import type { Metadata } from "next";
import { PasswordForm, ProfileForm } from "@/components/settings/profile-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBundle } from "@/modules/settings/server";

export const metadata: Metadata = { title: "Profile" };

export default async function Page() {
  const { user } = await getBundle();
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><div><CardTitle>Your details</CardTitle><CardDescription>How you appear in the app and where we send account emails.</CardDescription></div></CardHeader>
        <CardContent><ProfileForm user={user} /></CardContent>
      </Card>
      <Card>
        <CardHeader><div><CardTitle>Password</CardTitle><CardDescription>Changing it signs you out of every other device.</CardDescription></div></CardHeader>
        <CardContent><PasswordForm /></CardContent>
      </Card>
    </div>
  );
}
