"use client";

// Prominent "Data as of …" indicator that lives next to the dashboard
// title. Three jobs:
//
//   1. Show how recent the rendered data is — "updated 2 min ago", with
//      the absolute timestamp on hover.
//   2. Auto-refresh the route every 5 minutes via `router.refresh()`
//      (server re-renders, streams in, no full page reload) — but only
//      while the tab is visible. See `useAutoRefresh`.
//   3. Manual refresh button. Spins while pending; never blocks input.
//
// The server passes the latest `dbt_updated_at` (or any data freshness
// timestamp) as the `asOf` prop. The component computes the relative
// label on the client so it stays accurate between refreshes without
// hydration mismatches (delays the first relative render to client
// mount).

import { useState, useSyncExternalStore, useTransition } from "react";
import { RefreshCwIcon } from "lucide-react";
import { useAutoRefresh } from "@/lib/hooks/use-auto-refresh";
import { useReportTransition } from "@/lib/nav-progress-context";
import { cn } from "@/lib/utils";

// 30-second clock shared by every <DataFreshness> instance on the page.
//
// CRITICAL constraints (both will trigger "Maximum update depth exceeded"
// if violated):
//   1. `subscribe` must be the same function reference across renders.
//      If it's recreated inline inside the hook, React re-subscribes on
//      every render → if subscribe calls cb() synchronously → re-render
//      → re-subscribe → loop. Module-level fixes this.
//   2. `getSnapshot` must return the same value between ticks. A naive
//      `() => Date.now()` returns a new number every call; React thinks
//      the store changed, re-renders, calls getSnapshot again → loop.
//      We return `cachedNow` which only changes when the interval fires
//      or a new subscriber attaches.
//
// Server snapshot is 0 so SSR renders the absolute-time fallback without
// a hydration mismatch.

let cachedNow = 0;
const tickSubscribers = new Set<() => void>();
let tickInterval: ReturnType<typeof setInterval> | null = null;
const TICK_MS = 30_000;

function subscribeTick(cb: () => void): () => void {
  // Refresh the cached value so this just-mounted subscriber sees a
  // real timestamp on its very next snapshot read. Notify ONLY this
  // subscriber via cb() — and only when a fresh value was written.
  const prev = cachedNow;
  cachedNow = Date.now();
  tickSubscribers.add(cb);
  if (tickInterval === null) {
    tickInterval = setInterval(() => {
      cachedNow = Date.now();
      tickSubscribers.forEach((s) => s());
    }, TICK_MS);
  }
  if (prev !== cachedNow) cb();
  return () => {
    tickSubscribers.delete(cb);
    if (tickSubscribers.size === 0 && tickInterval !== null) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
  };
}

function getNowSnapshot(): number {
  return cachedNow;
}

function getNowServerSnapshot(): number {
  return 0;
}

function useTick(): number {
  return useSyncExternalStore(
    subscribeTick,
    getNowSnapshot,
    getNowServerSnapshot,
  );
}

export type DataFreshnessProps = {
  /** ISO timestamp of the data being rendered (e.g. max `dbt_updated_at`). */
  asOf: string | null;
  /** Override the refresh interval. Defaults to 1 hour (matches the dbt
   *  sync cadence — refreshing more often won't pull any new rows). */
  intervalMs?: number;
  /** Optional label override — defaults to "Data as of". */
  label?: string;
  className?: string;
};

export function DataFreshness({
  asOf,
  intervalMs = 60 * 60 * 1000,
  label = "Data as of",
  className,
}: DataFreshnessProps) {
  const [pending, startTransition] = useTransition();
  useReportTransition(pending);

  // Clock for relative-time labels + countdown. Server snapshot = 0,
  // client snapshot = Date.now() ticking every 30s. Shared interval
  // across all <DataFreshness> instances on the page.
  const now = useTick();

  // Track when we last *fired* a refresh so the countdown shows true
  // "time until next refresh". useAutoRefresh calls onTick on each fire.
  // Initial value of 0 means "haven't fired yet" — first useTick value
  // after hydration becomes the implicit baseline.
  const [lastRefreshAt, setLastRefreshAt] = useState<number>(0);
  const { refreshNow } = useAutoRefresh({
    intervalMs,
    onTick: () => setLastRefreshAt(Date.now()),
  });

  const onManualRefresh = () => {
    startTransition(() => {
      refreshNow();
      setLastRefreshAt(Date.now());
    });
  };

  const asOfDate = asOf ? new Date(asOf) : null;
  const validAsOf = asOfDate && !Number.isNaN(asOfDate.getTime()) ? asOfDate : null;

  // Until we've ticked once (now > 0) we don't know how stale the
  // countdown is — hide it. Once hydrated, anchor on the first tick if
  // we haven't seen a manual/auto refresh yet.
  const effectiveLastRefresh = lastRefreshAt || now;
  const nextRefreshIn =
    now > 0 ? Math.max(0, intervalMs - (now - effectiveLastRefresh)) : intervalMs;

  return (
    <div
      data-pending={pending ? "" : undefined}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-xs shadow-[var(--shadow-card)] data-[pending]:opacity-70 data-[pending]:transition-opacity",
        className,
      )}
      title={
        validAsOf
          ? `${label} ${validAsOf.toLocaleString()} — dbt syncs hourly; this page re-fetches every ${Math.round(intervalMs / 60_000)} min to match.`
          : "Data freshness unavailable"
      }
    >
      <span
        aria-hidden
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          validAsOf ? "bg-emerald-500" : "bg-amber-500",
        )}
      />
      <span className="text-muted-foreground">
        {label}{" "}
        <span className="font-medium text-foreground">
          {validAsOf ? <RelativeTime date={validAsOf} now={now} /> : "—"}
        </span>
      </span>
      <span
        className="hidden text-muted-foreground/70 sm:inline"
        title="dbt models sync hourly; next auto-refresh"
      >
        · next sync in {formatCountdown(nextRefreshIn)}
      </span>
      <button
        type="button"
        onClick={onManualRefresh}
        disabled={pending}
        aria-label="Refresh now"
        className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed"
      >
        <RefreshCwIcon
          className={cn("h-3.5 w-3.5", pending && "animate-spin")}
          aria-hidden
        />
      </button>
    </div>
  );
}

// Relative-time label that re-renders with the parent's `now` clock.
// SSR-safe — `now === 0` means "first render, server-side or pre-mount",
// so we fall back to the absolute time. The parent's useEffect sets `now`
// after mount, which causes a single client re-render to the relative
// label without an extra hook here.
function RelativeTime({ date, now }: { date: Date; now: number }) {
  if (now === 0) {
    return <>{date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</>;
  }
  return <>{formatRelative(date, now)}</>;
}

function formatRelative(d: Date, now: number): string {
  const diffSec = Math.max(0, Math.round((now - d.getTime()) / 1000));
  if (diffSec < 30) return "just now";
  if (diffSec < 90) return "1 min ago";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH} hr ago`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString();
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0s";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}
