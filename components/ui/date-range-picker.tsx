"use client";

// Primary date selector for the Sales / Setter dashboards.
//
// Visual: an Apple-feel pill button showing "{from} → {to}" with a
// calendar icon. Click opens a popover with two panes:
//
//   ┌──────────────────┬─────────────────────────────┐
//   │ This week        │  ◄  May 2026          ►     │
//   │ Previous week    │   S M T W T F S             │
//   │ This month       │  …calendar grid (range)…    │
//   │ Last month       │                             │
//   │ Last 7 days      │                             │
//   │ Last 30 days     │                             │
//   │ Last 90 days     │                             │
//   │ Year to date     │                             │
//   │ Custom           │                             │
//   └──────────────────┴─────────────────────────────┘
//
// URL-driven. Clicking a quick-button sets `?period=<key>` (no explicit
// from/to needed — the server resolves it via lib/period.ts). Picking a
// custom range in the calendar sets `?period=custom&from=…&to=…`.
// Sunday-anchored weeks via `weekStartsOn={0}` to match the NMM convention.

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarIcon, ChevronDownIcon } from "lucide-react";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";

import { useReportTransition } from "@/lib/nav-progress-context";
import {
  DATE_RANGE_OPTIONS,
  type DateRangeKey,
  type ResolvedDateRange,
} from "@/lib/period";
import { cn } from "@/lib/utils";

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function fromISO(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function formatPill(from: string, to: string): string {
  const f = new Date(from + "T00:00:00Z");
  const t = new Date(to + "T00:00:00Z");
  const sameYear = f.getUTCFullYear() === t.getUTCFullYear();
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  };
  const left = f.toLocaleDateString("en-US", opts);
  const right = t.toLocaleDateString("en-US", {
    ...opts,
    year: "numeric",
  });
  if (from === to) return right;
  // Same year → "May 10 → May 16, 2026"; different years → spell out
  if (sameYear) return `${left} → ${right}`;
  const leftFull = f.toLocaleDateString("en-US", { ...opts, year: "numeric" });
  return `${leftFull} → ${right}`;
}

export function DateRangePicker({
  pathname,
  resolved,
  className,
}: {
  /** Route to push to (the active route, kept as the base of router.push). */
  pathname: string;
  /** Currently-resolved range from lib/period.ts. */
  resolved: ResolvedDateRange;
  className?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  useReportTransition(pending);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Local range state for the calendar pane (committed on "Apply").
  // Reset on `resolved` changes by reading prop-derived state inline —
  // this is the React 19 "reset state when prop changes" pattern that
  // replaces the useEffect+setState anti-pattern. The picker is keyed by
  // the resolved range so a new range remounts the inner picker with the
  // correct initial draft.
  const [draft, setDraft] = useState<DateRange | undefined>(() => ({
    from: fromISO(resolved.from),
    to: fromISO(resolved.to),
  }));
  const [seenResolved, setSeenResolved] = useState(
    `${resolved.from}|${resolved.to}`,
  );
  if (seenResolved !== `${resolved.from}|${resolved.to}`) {
    setSeenResolved(`${resolved.from}|${resolved.to}`);
    setDraft({ from: fromISO(resolved.from), to: fromISO(resolved.to) });
  }

  // Outside click + ESC to close.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pushUrl = (next: URLSearchParams) => {
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
      setOpen(false);
    });
  };

  const pickQuick = (key: DateRangeKey) => {
    const next = new URLSearchParams(params);
    next.set("period", key);
    if (key !== "custom") {
      next.delete("from");
      next.delete("to");
    }
    pushUrl(next);
  };

  const applyCustom = () => {
    if (!draft?.from || !draft?.to) return;
    const next = new URLSearchParams(params);
    next.set("period", "custom");
    next.set("from", toISO(draft.from));
    next.set("to", toISO(draft.to));
    pushUrl(next);
  };

  return (
    <div ref={wrapRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-pending={pending ? "" : undefined}
        className="group inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-[var(--shadow-card)] transition-colors hover:border-foreground/40 data-[pending]:opacity-70"
        style={{ transitionTimingFunction: "var(--ease-out)" }}
      >
        <CalendarIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
        <span className="tabular-nums">
          {formatPill(resolved.from, resolved.to)}
        </span>
        <span className="ml-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {resolved.label}
        </span>
        <ChevronDownIcon
          className="h-3.5 w-3.5 text-muted-foreground transition-transform group-aria-expanded:rotate-180"
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Pick a date range"
          className="absolute right-0 top-full z-30 mt-2 flex w-[36rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-popover shadow-[var(--shadow-elevated)] sm:flex-row"
        >
          {/* Left rail — quick buttons */}
          <ul className="flex shrink-0 flex-row gap-1 overflow-x-auto border-b border-border bg-card/60 p-2 text-sm sm:w-44 sm:flex-col sm:gap-0.5 sm:overflow-visible sm:border-b-0 sm:border-r">
            {DATE_RANGE_OPTIONS.map((opt) => {
              const active = opt.key === resolved.period;
              return (
                <li key={opt.key} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => pickQuick(opt.key)}
                    className={cn(
                      "w-full whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-[13px] font-medium transition-colors",
                      active
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    {opt.label}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Right pane — calendar + apply */}
          <div className="flex flex-1 flex-col">
            <div className="px-3 pt-3">
              <DayPicker
                mode="range"
                numberOfMonths={2}
                weekStartsOn={0}
                selected={draft}
                onSelect={setDraft}
                defaultMonth={fromISO(resolved.from)}
                showOutsideDays
                classNames={{
                  root: "rdp-root",
                  months: "flex flex-col gap-3 md:flex-row md:gap-6",
                  month: "space-y-2",
                  caption_label: "font-heading text-sm font-semibold",
                  nav: "flex gap-1",
                  button_previous:
                    "h-7 w-7 rounded-md border border-border bg-background text-foreground hover:bg-secondary inline-flex items-center justify-center",
                  button_next:
                    "h-7 w-7 rounded-md border border-border bg-background text-foreground hover:bg-secondary inline-flex items-center justify-center",
                  month_grid: "w-full border-collapse",
                  weekday:
                    "text-[10px] font-medium uppercase tracking-wider text-muted-foreground p-1",
                  day: "p-0.5",
                  day_button:
                    "h-8 w-8 rounded-md text-sm font-medium hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-accent/40",
                  today: "font-bold text-accent",
                  range_start:
                    "[&_button]:bg-foreground [&_button]:text-background [&_button]:hover:bg-foreground/90",
                  range_end:
                    "[&_button]:bg-foreground [&_button]:text-background [&_button]:hover:bg-foreground/90",
                  range_middle:
                    "[&_button]:bg-secondary/60 [&_button]:text-foreground [&_button]:rounded-none [&_button]:hover:bg-secondary",
                  outside: "[&_button]:text-muted-foreground/40",
                  disabled: "[&_button]:opacity-40 [&_button]:pointer-events-none",
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-border bg-card/40 px-3 py-2 text-xs">
              <span className="text-muted-foreground">
                {draft?.from && draft?.to
                  ? `${toISO(draft.from)} → ${toISO(draft.to)}`
                  : "Pick start, then end date"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applyCustom}
                  disabled={!draft?.from || !draft?.to}
                  className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background shadow-sm transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
