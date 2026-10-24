"use client";
import { ThemeProvider, useTheme } from "next-themes";
import * as React from "react";
import { Toaster } from "@/components/ui/toaster";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <Toaster />
    </ThemeProvider>
  );
}

/**
 * Applies the theme saved in the database on a device that has no local choice yet
 * (first sign-in on a new browser). After that, next-themes' local storage keeps it instant.
 */
export function ThemeSync({ theme }: { theme: "LIGHT" | "DARK" | "SYSTEM" }) {
  const { setTheme } = useTheme();
  React.useEffect(() => {
    try {
      if (!window.localStorage.getItem("theme")) setTheme(theme.toLowerCase());
    } catch {
      /* storage unavailable — system default applies */
    }
  }, [theme, setTheme]);
  return null;
}
