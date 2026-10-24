"use client";
import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/utils";
import { logoutAction } from "@/modules/auth/actions";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const signOut = () =>
    startTransition(async () => {
      const res = await logoutAction();
      if (res.ok) {
        router.replace(res.data.redirectTo);
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="grid size-11 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary transition hover:brightness-95 md:size-10"
        aria-label="Account menu"
      >
        {initials(name)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <p className="font-medium">{name}</p>
          <p className="truncate text-xs text-muted">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings/profile">
            <Settings className="size-4" aria-hidden /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={signOut} disabled={pending}>
          <LogOut className="size-4" aria-hidden /> {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
