import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <p className="text-sm font-medium text-muted">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">We can&apos;t find that page</h1>
        <p className="mt-2 text-muted">The link may be old, or the record may have been removed.</p>
        <Button asChild className="mt-6">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
