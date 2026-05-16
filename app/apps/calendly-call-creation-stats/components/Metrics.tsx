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

  // Earliest/latest scheduled call inside the current filter set — answers
  // "where's the last call?" without scrolling the whole table.
  const sortedTimes = rows
    .map((r) => r.startTime)
    .filter((t): t is string => !!t)
    .sort();
  const firstCall = sortedTimes[0] ?? null;
  const lastCall = sortedTimes[sortedTimes.length - 1] ?? null;

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

  const pct = (n: number) => (total === 0 ? "" : `${Math.round((n / total) * 100)}% of calls`);

  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
          <span>
            <span className="font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Window
            </span>{" "}
            <span className="font-mono text-foreground">
              {fmtDate(window.start)} <span className="text-muted-foreground">→</span>{" "}
              {fmtDate(window.end)}
            </span>
          </span>
          {firstCall && lastCall && (
            <>
              <span className="text-border">·</span>
              <span>
                <span className="font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Earliest
                </span>{" "}
                <span className="font-mono text-foreground">{fmtDate(firstCall)}</span>
              </span>
              <span className="text-border">·</span>
              <span>
                <span className="font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Latest
                </span>{" "}
                <span className="font-mono text-foreground">{fmtDate(lastCall)}</span>
              </span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Card label="Matched Calls" value={total} valueClass="text-accent" />
        <Card label="Unique Prospects" value={uniqueInvitees} valueClass="text-indigo-600" />
        <Card label="Active Calls" value={active} valueClass="text-emerald-600" sub={pct(active)} />
        <Card label="Canceled Calls" value={canceled} valueClass="text-rose-600" sub={pct(canceled)} />
        <Card
          label="Canceled Prospects"
          value={canceledOnly}
          valueClass="text-rose-600"
          sub="without active booking"
        />
        <Card
          label="Double Bookings"
          value={doubleBookings}
          valueClass={doubleBookings > 0 ? "text-rose-600" : "text-foreground"}
          sub={doubleBookings > 0 ? "active multi-host conflict" : undefined}
        />
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

function Card({
  label,
  value,
  valueClass,
  sub,
}: {
  label: string;
  value: number;
  valueClass: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className={"mt-2 font-mono text-3xl font-semibold leading-none " + valueClass}>{value}</p>
      {sub ? <p className="mt-2 text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
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
