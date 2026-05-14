"use client";

// 3-state cycle button: System → Light → Dark → System.
//
// Reads the current value as a prop (server passes it from getTheme()),
// posts the next value via the setTheme server action, then calls
// router.refresh() so the layout re-renders with the new `dark` class
// resolution. The inline pre-paint script in app/layout.tsx keeps the
// transition flash-free.

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { setTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const NEXT: Record<Theme, Theme> = {
  system: "light",
  light: "dark",
  dark: "system",
};

const LABEL: Record<Theme, string> = {
  system: "System theme",
  light: "Light mode",
  dark: "Dark mode",
};

export function DarkModeToggle({
  current,
  className,
}: {
  current: Theme;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // When `theme === "system"`, follow live OS preference changes
  // without requiring a reload — the user can flip System dark in
  // Settings and the app reflects it immediately.
  useEffect(() => {
    if (current !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.classList.toggle("dark", mql.matches);
    };
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, [current]);

  const onClick = () => {
    const next = NEXT[current];
    startTransition(async () => {
      // Optimistic: flip the html class before the server roundtrip so
      // the visual feedback is instant. The server action persists the
      // cookie and router.refresh() reconciles.
      if (typeof document !== "undefined") {
        applyThemeClass(next);
      }
      await setTheme(next);
      router.refresh();
    });
  };

  const Icon = current === "system" ? MonitorIcon : current === "light" ? SunIcon : MoonIcon;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${LABEL[current]} — click to cycle`}
      title={`${LABEL[current]} — click for ${LABEL[NEXT[current]]}`}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-foreground/40 hover:text-foreground",
        pending ? "opacity-60" : "",
        className,
      )}
      style={{ transitionTimingFunction: "var(--ease-out)" }}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

// Mirror the logic in the inline pre-paint script in app/layout.tsx so
// the optimistic update doesn't disagree with the server's next render.
function applyThemeClass(theme: Theme): void {
  const root = document.documentElement;
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", isDark);
}
