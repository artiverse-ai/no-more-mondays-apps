"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useTransition } from "react";

const WINDOWS = [
  { value: 1, label: "1 day" },
  { value: 3, label: "3 days" },
  { value: 7, label: "1 week" },
  { value: 14, label: "2 weeks" },
  { value: 30, label: "30 days" },
];

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

export function TeamFilters({
  email,
  defaultDate,
  defaultDays,
  defaultTz,
}: {
  email: string;
  defaultDate: string;
  defaultDays: number;
  defaultTz: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) next.set(k, v);
    startTransition(() =>
      router.push(`/apps/calendar/team/${encodeURIComponent(email)}?${next.toString()}`, {
        scroll: false,
      })
    );
  };

  const big = fmtBig(defaultDate, defaultTz);
  const endIso = shiftDay(defaultDate, Math.max(0, defaultDays - 1));
  const endB = fmtBig(endIso, defaultTz);
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
      {/* Date range row — same visual structure as the main page filter */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => update({ date: shiftDay(defaultDate, -Math.max(1, defaultDays)) })}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background hover:border-foreground/40"
            aria-label="Previous window"
          >
            <span aria-hidden>‹</span>
          </button>

          <button
            type="button"
            onClick={openPicker}
            title="Click to pick a start date"
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

          <span className="px-2 text-muted-foreground">→</span>

          <div className="flex flex-col items-start rounded-md px-3 py-1 text-left">
            <span className="font-heading text-2xl font-semibold leading-none tracking-tight">
              {endB.weekday}
            </span>
            <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
              {endB.rest}
            </span>
          </div>

          <button
            type="button"
            onClick={() => update({ date: shiftDay(defaultDate, Math.max(1, defaultDays)) })}
            className="ml-2 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background hover:border-foreground/40"
            aria-label="Next window"
          >
            <span aria-hidden>›</span>
          </button>

          <span className="ml-3 rounded-full border border-border bg-secondary/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            {defaultDays} day{defaultDays === 1 ? "" : "s"}
          </span>
        </div>

        {pending ? (
          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
            updating
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-border pt-5">
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            How many days to show?
          </p>
          <div className="inline-flex flex-wrap rounded-xl border border-border bg-background p-1">
            {WINDOWS.map((w) => (
              <button
                key={w.value}
                type="button"
                onClick={() => update({ days: String(w.value) })}
                className={`relative px-3 py-2 text-sm font-medium transition-colors ${
                  w.value === defaultDays
                    ? "rounded-lg bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {w.label}
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

