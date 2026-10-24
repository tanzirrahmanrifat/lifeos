"use client";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { voidPaymentAction } from "@/modules/payments/actions";

export function VoidPaymentButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const doVoid = () =>
    startTransition(async () => {
      const res = await voidPaymentAction(paymentId);
      if (res.ok) {
        toast.success("Payment voided");
        router.refresh();
      } else toast.error(res.error.message);
    });
  return (
    <ConfirmButton size="sm" variant="ghost" onConfirm={doVoid} loading={pending} confirmLabel="Confirm void">
      Void
    </ConfirmButton>
  );
}
