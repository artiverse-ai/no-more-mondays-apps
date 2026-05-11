"use client";

import { useRef, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern (ET) — NYC" },
  { value: "America/Chicago", label: "Central (CT) — Chicago" },
  { value: "America/Phoenix", label: "Mountain (MST) — Phoenix" },
  { value: "America/Los_Angeles", label: "Pacific (PT) — LA" },
  { value: "America/Mexico_City", label: "Mexico City" },
  { value: "Europe/London", label: "London (BST)" },
  { value: "UTC", label: "UTC" },
];

const DURATIONS = [45, 60];

// Slot interval is locked to call length:
//   45-min call → slots open every 1 hour
//   60-min call → slots open every 1h 30m
const INTERVAL_LABEL = (duration: number): string =>
  duration === 45 ? "every 1 hour" : "every 1h 30m";

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

function daysBetween(fromIso: string, toIso: string): number {
  const f = new Date(fromIso + "T00:00:00Z").getTime();
  const t = new Date(toIso + "T00:00:00Z").getTime();
  return Math.round((t - f) / 86400000) + 1;
}

const shortName = (email: string) => email.split("@")[0];

export function RangeFilters({
  defaultFrom,
  defaultTo,
  defaultDuration,
  defaultTz,
  allMembers,
  selectedTeam,
}: {
  defaultFrom: string;
  defaultTo: string;
  defaultDuration: number;
  defaultTz: string;
  allMembers: string[];
  selectedTeam: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) next.set(k, v);
    // interval is now auto-derived from duration; never carry a stale value.
    next.delete("interval");
    startTransition(() => router.push(`/apps/calendar?${next.toString()}`, { scroll: false }));
  };

  const openFrom = () => {
    const el = fromRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") el.showPicker();
    else el.focus();
  };
  const openTo = () => {
    const el = toRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") el.showPicker();
    else el.focus();
  };

  const fromB = fmtBig(defaultFrom, defaultTz);
  const toB = fmtBig(defaultTo, defaultTz);
  const days = daysBetween(defaultFrom, defaultTo);

  return (
    <div
      data-pending={pending ? "" : undefined}
      className="space-y-5 data-[pending]:opacity-70 data-[pending]:transition-opacity"
    >
      {/* Date range row */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const newFrom = shiftDay(defaultFrom, -days);
              const newTo = shiftDay(defaultTo, -days);
              update({ from: newFrom, to: newTo });
            }}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background hover:border-foreground/40"
            aria-label="Previous range"
          >
            <span aria-hidden>‹</span>
          </button>

          <button
            type="button"
            onClick={openFrom}
            title="Click to pick start date"
            className="group flex cursor-pointer flex-col items-start rounded-md px-3 py-1 text-left transition-colors hover:bg-secondary"
          >
            <span className="font-heading text-2xl font-semibold leading-none tracking-tight">
              {fromB.weekday}
            </span>
            <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
              {fromB.rest}
              <span className="opacity-50 transition-opacity group-hover:opacity-100">📅</span>
            </span>
          </button>
          <input
            ref={fromRef}
            type="date"
            value={defaultFrom}
            max={defaultTo}
            onChange={(e) => update({ from: e.target.value })}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />

          <span className="px-2 text-muted-foreground">→</span>

          <button
            type="button"
            onClick={openTo}
            title="Click to pick end date"
            className="group flex cursor-pointer flex-col items-start rounded-md px-3 py-1 text-left transition-colors hover:bg-secondary"
          >
            <span className="font-heading text-2xl font-semibold leading-none tracking-tight">
              {toB.weekday}
            </span>
            <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
              {toB.rest}
              <span className="opacity-50 transition-opacity group-hover:opacity-100">📅</span>
            </span>
          </button>
          <input
            ref={toRef}
            type="date"
            value={defaultTo}
            min={defaultFrom}
            onChange={(e) => update({ to: e.target.value })}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />

          <button
            type="button"
            onClick={() => {
              const newFrom = shiftDay(defaultFrom, days);
              const newTo = shiftDay(defaultTo, days);
              update({ from: newFrom, to: newTo });
            }}
            className="ml-2 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background hover:border-foreground/40"
            aria-label="Next range"
          >
            <span aria-hidden>›</span>
          </button>

          <span className="ml-3 rounded-full border border-border bg-secondary/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            {days} day{days === 1 ? "" : "s"}
          </span>
        </div>

        {pending ? (
          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
            updating
          </span>
        ) : null}
      </div>

      {/* Duration / interval / TZ row */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-border pt-5">
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Call length
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
            Slots open
          </p>
          <div
            className="rounded-lg border border-dashed border-border bg-secondary/20 px-3 py-2 text-sm font-medium text-muted-foreground"
            title="Auto-paired with call length"
          >
            {INTERVAL_LABEL(defaultDuration)}
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

      {/* Closer filter — multi-select. Empty selection = whole team. */}
      <div className="space-y-2 border-t border-border pt-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Filter by closer
          </p>
          {selectedTeam.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                const next = new URLSearchParams(params);
                next.delete("team");
                next.delete("interval");
                startTransition(() => router.push(`/apps/calendar?${next.toString()}`, { scroll: false }));
              }}
              className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium text-muted-foreground hover:border-foreground/40 hover:text-foreground"
            >
              clear ({selectedTeam.length} selected)
            </button>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              click names to filter
            </span>
          )}
        </div>
        <ul className="flex flex-wrap gap-1.5">
          {allMembers.map((email) => {
            const isActive = selectedTeam.includes(email);
            return (
              <li key={email}>
                <button
                  type="button"
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.delete("interval");
                    const cur = new Set(selectedTeam);
                    if (cur.has(email)) cur.delete(email);
                    else cur.add(email);
                    if (cur.size === 0) next.delete("team");
                    else next.set("team", Array.from(cur).join(","));
                    startTransition(() => router.push(`/apps/calendar?${next.toString()}`, { scroll: false }));
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-foreground hover:border-foreground/40"
                  }`}
                >
                  {shortName(email)}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
