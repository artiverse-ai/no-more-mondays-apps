"use client";

import { useState } from "react";
import { CalendlyEventType, DebugStats, Row } from "../lib/types";
import { fmtDate, normHostValue } from "../lib/format";

type Props = {
  rows: Row[];
  allRows: Row[];
  hostFilter: string;
  matchedEventTypes: CalendlyEventType[];
  debug: DebugStats;
  window: { start: string; end: string };
};

export function Metrics({ rows, allRows, hostFilter, debug, window }: Props) {
  const total = rows.length;
  const active = rows.filter((r) => r.status === "active").length;
  const canceled = rows.filter((r) => r.status === "canceled").length;
  const uniqueInvitees = new Set(rows.map((r) => r.inviteeEmail || r.id)).size;

  // Prospects who canceled and have no active booking (host scope only;
  // ignore the Status chip so toggling it doesn't change this count).
  const scope = allRows.filter((r) => hostMatches(r, hostFilter));
  const prospect = new Map<string, { active: boolean; canceled: boolean }>();
  for (const r of scope) {
    const key = r.inviteeEmail || r.id;
    const cur = prospect.get(key) ?? { active: false, canceled: false };
    if (r.status === "active") cur.active = true;
    if (r.status === "canceled") cur.canceled = true;
    prospect.set(key, cur);
  }
  const canceledOnly = [...prospect.values()].filter((p) => p.canceled && !p.active).length;

  // Double-booked prospects: ≥2 active bookings with ≥2 different hosts.
  const byInvitee = new Map<string, Row[]>();
  for (const r of rows) {
    const k = r.inviteeEmail || r.id;
    const arr = byInvitee.get(k) ?? [];
    arr.push(r);
    byInvitee.set(k, arr);
  }
  let doubleBookings = 0;
  for (const list of byInvitee.values()) {
    const activeBookings = list.filter((b) => b.status === "active");
    const uniqueHosts = new Set(
      activeBookings.flatMap((b) => (b.hostNames.length ? b.hostNames : [b.hostName])).filter(
        (h) => h && h !== "—",
      ),
    );
    if (activeBookings.length >= 2 && uniqueHosts.size >= 2) doubleBookings++;
  }

  return (
    <section className="space-y-3">
      {/* Window + headline stats — one tight row */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Window
          </span>
          <span className="font-mono text-sm text-foreground">
            {fmtDate(window.start)} <span className="text-muted-foreground">→</span>{" "}
            {fmtDate(window.end)}
          </span>
          <span className="ml-auto flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <Stat label="Calls" value={total} tone="accent" />
            <Stat label="Prospects" value={uniqueInvitees} tone="indigo" />
            <Stat label="Active" value={active} tone="green" />
            <Stat label="Canceled" value={canceled} tone={canceled > 0 ? "rose" : "muted"} />
          </span>
        </div>

        {(doubleBookings > 0 || canceledOnly > 0) && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3 text-xs">
            {doubleBookings > 0 && (
              <Flag tone="rose">
                ⚠ {doubleBookings} double-booked{" "}
                <span className="text-rose-700/70">(multi-host conflict)</span>
              </Flag>
            )}
            {canceledOnly > 0 && (
              <Flag tone="amber">
                {canceledOnly} canceled prospect{canceledOnly === 1 ? "" : "s"}{" "}
                <span className="text-amber-700/70">(no active booking)</span>
              </Flag>
            )}
          </div>
        )}
      </div>

      {debug.windowsFailed > 0 && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-800">
          <p className="font-medium">
            ⚠ {debug.windowsFailed} of {debug.windowsTotal} time windows failed
            to load. Results may be incomplete — try again, or use a shorter
            range.
          </p>
          <details className="mt-1.5">
            <summary className="cursor-pointer text-rose-700/80 hover:text-rose-700">
              Show errors
            </summary>
            <ul className="mt-1 list-disc pl-4 font-mono text-[11px]">
              {debug.fetchErrors.slice(0, 5).map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </details>
        </div>
      )}

      <TechnicalDetails debug={debug} />
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "accent" | "indigo" | "green" | "rose" | "muted";
}) {
  const toneCls =
    tone === "accent"
      ? "text-accent"
      : tone === "indigo"
      ? "text-indigo-600"
      : tone === "green"
      ? "text-emerald-600"
      : tone === "rose"
      ? "text-rose-600"
      : "text-foreground/60";
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className={"font-mono text-xl font-semibold leading-none " + toneCls}>
        {value}
      </span>
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
    </span>
  );
}

function Flag({
  tone,
  children,
}: {
  tone: "rose" | "amber";
  children: React.ReactNode;
}) {
  const cls =
    tone === "rose"
      ? "border-rose-500/40 bg-rose-500/10 text-rose-700"
      : "border-amber-500/40 bg-amber-500/10 text-amber-700";
  return (
    <span className={"inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 " + cls}>
      {children}
    </span>
  );
}

function TechnicalDetails({ debug }: { debug: DebugStats }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="text-[11px] text-muted-foreground">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="font-mono text-muted-foreground hover:text-foreground"
      >
        {open ? "▾" : "▸"} pipeline details
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-2 font-mono">
          <Step n={debug.eventTypesScanned}>event types scanned</Step>
          <Arrow />
          <Step n={debug.matchedTypes}>matched funnel</Step>
          <Arrow />
          <Step n={debug.windowsTotal - debug.windowsFailed}>
            of {debug.windowsTotal} windows ok
          </Step>
          <Arrow />
          <span>
            <Num n={debug.eventsFetched} /> events{" "}
            <span className="text-emerald-700">({debug.activeFetched} active</span>{" "}
            <span className="text-rose-700">/ {debug.canceledFetched} canceled)</span>
          </span>
          <Arrow />
          <Step n={debug.finalRows}>final bookings</Step>
        </div>
      )}
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <span>
      <Num n={n} /> {children}
    </span>
  );
}
function Num({ n, className = "text-foreground" }: { n: number; className?: string }) {
  return <span className={"mr-1 font-medium " + className}>{n}</span>;
}
function Arrow() {
  return <span className="text-border">→</span>;
}

function hostMatches(r: Row, selectedHost: string): boolean {
  if (!selectedHost || selectedHost === "all") return true;
  const selected = normHostValue(selectedHost);
  const vals = [
    ...r.hostNames,
    ...r.hostEmails,
    r.hostName,
    r.hostEmail,
    r.allHosts,
    r.allHostEmails,
  ]
    .filter(Boolean)
    .map(normHostValue);
  return vals.some((h) => h === selected || h.includes(selected));
}
