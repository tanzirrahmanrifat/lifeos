import { FileText } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";

const ORDER = ["DRAFT", "SENT", "PARTIALLY_PAID", "OVERDUE", "PAID"] as const;
const LABEL: Record<string, string> = { DRAFT: "Draft", SENT: "Sent", PARTIALLY_PAID: "Partially paid", PAID: "Paid", OVERDUE: "Overdue" };
const TONE: Record<string, string> = { DRAFT: "bg-surface-2 text-muted", SENT: "bg-info-soft text-info", PARTIALLY_PAID: "bg-warning-soft text-warning", PAID: "bg-success-soft text-success", OVERDUE: "bg-danger-soft text-danger" };

export function InvoiceSummaryWidget({ counts }: { counts: Record<string, number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Invoice summary</CardTitle>
        <Link href="/invoices" className="text-sm font-medium text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <div className="flex-1 px-5 pb-5">
        {total === 0 ? (
          <EmptyState icon={FileText} title="No invoices yet" description="Create your first invoice to see status counts here." action={<Link href="/invoices/new" className={buttonVariants({ variant: "outline", size: "sm" })}>New invoice</Link>} className="py-8" />
        ) : (
          <ul className="space-y-2">
            {ORDER.filter((s) => counts[s]).map((s) => (
              <li key={s} className="flex items-center justify-between text-sm">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[s]}`}>{LABEL[s]}</span>
                <span className="tabular font-medium">{counts[s]}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
