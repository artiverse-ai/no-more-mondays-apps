"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useTransition } from "react";

const DURATIONS = [15, 30, 45, 60];

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern (ET) — NYC" },
  { value: "America/Chicago", label: "Central (CT) — Chicago" },
  { value: "America/Phoenix", label: "Mountain (MST) — Phoenix" },
  { value: "America/Los_Angeles", label: "Pacific (PT) — LA" },
  { value: "America/Mexico_City", label: "Mexico City" },
  { value: "Europe/London", label: "London (BST)" },
  { value: "UTC", label: "UTC" },
];

function shiftDay(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function fmtBig(iso: string, tz: string): { weekday: string; rest: string } {
  const dt = new Date(iso + "T12:00:00Z");
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: tz }).format(dt);
  const rest = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: tz,
  }).format(dt);
  return { weekday, rest };
}

export function Filters({
  defaultDate,
  defaultDuration,
  defaultTz,
}: {
  defaultDate: string;
  defaultDuration: number;
  defaultTz: string;
  defaultFromHour?: number;
  defaultToHour?: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) next.set(k, v);
    startTransition(() => router.push(`/apps/calendar?${next.toString()}`, { scroll: false }));
  };

  const big = fmtBig(defaultDate, defaultTz);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const el = dateInputRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") el.showPicker();
    else el.focus();
  };

  return (
    <div
      data-pending={pending ? "" : undefined}
      className="space-y-5 data-[pending]:opacity-70 data-[pending]:transition-opacity"
    >
      {/* Date row — big, prominent */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => update({ date: shiftDay(defaultDate, -1) })}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background hover:border-foreground/40"
            aria-label="Previous day"
          >
            <span aria-hidden>‹</span>
          </button>

          <button
            type="button"
            onClick={openPicker}
            title="Click to pick a date"
            className="group flex cursor-pointer flex-col items-start rounded-md px-3 py-1 text-left transition-colors hover:bg-secondary"
          >
            <span className="font-heading text-2xl font-semibold leading-none tracking-tight">
              {big.weekday}
            </span>
            <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
              {big.rest}
              <span className="opacity-50 transition-opacity group-hover:opacity-100">📅</span>
            </span>
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={defaultDate}
            onChange={(e) => update({ date: e.target.value })}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />

          <button
            type="button"
            onClick={() => update({ date: shiftDay(defaultDate, 1) })}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background hover:border-foreground/40"
            aria-label="Next day"
          >
            <span aria-hidden>›</span>
          </button>
        </div>

        {pending ? (
          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
            updating
          </span>
        ) : null}
      </div>

      {/* Duration + timezone row */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-border pt-5">
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            How long is the call?
          </p>
          <div className="inline-flex rounded-xl border border-border bg-background p-1">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => update({ duration: String(d) })}
                className={`relative px-4 py-2 text-sm font-medium transition-colors ${
                  d === defaultDuration
                    ? "rounded-lg bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {d} min
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Show times in
          </p>
          <select
            value={defaultTz}
            onChange={(e) => update({ tz: e.target.value })}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:border-foreground/40"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}


