import { ThemeSync } from "@/components/providers";
import { AppShell } from "@/components/layout/app-shell";
import { Sidebar } from "@/components/layout/sidebar";
import { getBundle } from "@/modules/settings/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, settings } = await getBundle();
  return (
    <>
      <ThemeSync theme={settings.theme} />
      <AppShell sidebar={<Sidebar />} user={{ name: user.name, email: user.email }}>
        {children}
      </AppShell>
    </>
  );
}
