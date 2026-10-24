"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateThemeAction } from "@/modules/settings/actions";

export const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun, db: "LIGHT" },
  { value: "dark", label: "Dark", icon: Moon, db: "DARK" },
  { value: "system", label: "System", icon: Monitor, db: "SYSTEM" },
] as const;

/** Applies instantly (local) and saves to the account so other devices follow. */
export function useThemeChoice() {
  const { theme, setTheme } = useTheme();
  const choose = React.useCallback(
    async (value: string) => {
      const option = THEME_OPTIONS.find((o) => o.value === value);
      if (!option) return;
      setTheme(option.value);
      const res = await updateThemeAction(option.db);
      if (!res.ok) toast.error("Theme changed here, but we couldn't save it to your account.");
    },
    [setTheme],
  );
  return { theme: theme ?? "system", choose };
}

export function ThemeToggle() {
  const { theme, choose } = useThemeChoice();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change theme">
          <Sun className="size-[18px] dark:hidden" aria-hidden />
          <Moon className="hidden size-[18px] dark:block" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuRadioGroup value={theme} onValueChange={choose}>
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon className="size-4" aria-hidden />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
