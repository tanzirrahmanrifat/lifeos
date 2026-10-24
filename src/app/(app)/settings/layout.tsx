import { SettingsNav } from "@/components/settings/settings-nav";
import { PageHeader } from "@/components/ui/page-header";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" description="Your profile, business details, invoicing defaults and preferences." />
      <SettingsNav />
      {children}
    </div>
  );
}
