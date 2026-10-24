"use client";
import { Ban, Download, Eye, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { deleteInvoiceAction, setInvoiceStatusAction } from "@/modules/invoices/actions";
import type { InvoiceDTO } from "@/modules/invoices/types";

export function InvoiceStatusActions({ invoice }: { invoice: InvoiceDTO }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const setStatus = (status: "SENT" | "VIEWED" | "CANCELLED") =>
    startTransition(async () => {
      const res = await setInvoiceStatusAction({ id: invoice.id, status });
      if (res.ok) {
        toast.success(status === "SENT" ? "Marked as sent" : status === "VIEWED" ? "Marked as viewed" : "Invoice cancelled");
        router.refresh();
      } else toast.error(res.error.message);
    });

  const remove = () =>
    startTransition(async () => {
      const res = await deleteInvoiceAction(invoice.id);
      if (res.ok) {
        toast.success("Draft deleted");
        router.replace("/invoices");
      } else toast.error(res.error.message);
    });

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" asChild>
        <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noopener noreferrer">
          <Download className="size-4" aria-hidden /> PDF
        </a>
      </Button>
      {invoice.status === "DRAFT" && (
        <>
          <Button variant="outline" asChild>
            <Link href={`/invoices/${invoice.id}/edit`}>Edit</Link>
          </Button>
          <Button onClick={() => setStatus("SENT")} loading={pending}>
            <Send className="size-4" aria-hidden /> Mark as sent
          </Button>
          <ConfirmButton onConfirm={remove} loading={pending} confirmLabel="Confirm delete">
            Delete draft
          </ConfirmButton>
        </>
      )}
      {invoice.status === "SENT" && (
        <Button variant="outline" onClick={() => setStatus("VIEWED")} loading={pending}>
          <Eye className="size-4" aria-hidden /> Mark as viewed
        </Button>
      )}
      {(invoice.status === "SENT" || invoice.status === "VIEWED") && (
        <ConfirmButton variant="outline" onConfirm={() => setStatus("CANCELLED")} loading={pending} confirmLabel="Confirm cancel">
          <Ban className="size-4" aria-hidden /> Cancel
        </ConfirmButton>
      )}
    </div>
  );
}
