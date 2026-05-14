"use client";

// Silent route refresh on an interval. Used by `<DataFreshness>` and any
// other component that wants to keep server-rendered data fresh without
// a full page reload — `router.refresh()` re-runs the server component
// tree and streams updated HTML in.
//
// Defaults to 5 minutes. Skips ticks while the document is hidden so we
// don't burn BigQuery slots on backgrounded tabs, and fires once
// immediately on visibility-return so the user sees fresh data the
// instant they come back to the tab.

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export type UseAutoRefreshOptions = {
  /** How often to refresh, in ms. Defaults to 5 minutes. */
  intervalMs?: number;
  /** Set true to suspend the timer (e.g. while a popover is open). */
  paused?: boolean;
  /** Optional callback whenever a refresh fires — handy for resetting
   *  a visible "next refresh in Xm" counter. */
  onTick?: () => void;
};

export function useAutoRefresh({
  intervalMs = 5 * 60 * 1000,
  paused = false,
  onTick,
}: UseAutoRefreshOptions = {}): { refreshNow: () => void } {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTickRef = useRef(onTick);
  // Keep the ref pointed at the latest callback so the interval doesn't
  // close over a stale function. Updating in an effect (not during
  // render) satisfies react-hooks/refs.
  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  const refreshNow = () => {
    router.refresh();
    onTickRef.current?.();
  };

  useEffect(() => {
    if (paused) return;

    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      refreshNow();
    };

    timer.current = setInterval(tick, intervalMs);

    // When the tab regains visibility, fire one refresh immediately so
    // the user lands on fresh data — then resume the regular interval.
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshNow();
        if (timer.current) clearInterval(timer.current);
        timer.current = setInterval(tick, intervalMs);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (timer.current) clearInterval(timer.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // refreshNow is stable through the ref; router from next/navigation is stable too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, paused]);

  return { refreshNow };
}
