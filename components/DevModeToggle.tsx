"use client";

import { CodeIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toggleDevMode } from "@/lib/dev-mode";
import { cn } from "@/lib/utils";

/**
 * Admin-only segmented toggle in dashboard heros. Flips the dev-mode cookie
 * then `router.refresh()` so server-rendered tooltips re-read the new value.
 *
 * Render only when the caller has confirmed admin status — the toggle itself
 * doesn't gate visibility (server-side concern).
 */
export function DevModeToggle({
  current,
  className,
}: {
  current: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      await toggleDevMode();
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={current}
      title={
        current
          ? "Dev mode ON — info tooltips show SQL + source. Click to switch to Executive."
          : "Executive mode — info tooltips show plain-English only. Click to switch to Dev."
      }
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium uppercase tracking-[0.12em] shadow-sm transition-colors",
        current
          ? "border-alert-blue/40 bg-alert-blue/10 text-alert-blue hover:bg-alert-blue/15"
          : "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground",
        pending ? "opacity-60" : "",
        className,
      )}
    >
      <CodeIcon className="h-3 w-3" aria-hidden />
      {current ? "Dev" : "Exec"}
    </button>
  );
}
