"use client";

import { useState } from "react";
import { CalendlyEventType, Row } from "../lib/types";
import { fmtDate } from "../lib/format";
import { MatchedPills } from "./MatchedPills";

type Props = {
  rows: Row[];
  totalRows: number;
  matchedEventTypes: CalendlyEventType[];
  onInspect: (id: string) => void;
};

type Group = {
  hostKey: string;
  hostName: string;
  hostEmail: string;
  bookings: Row[];
  totalCount: number;
  activeCount: number;
  canceledCount: number;
  uniqueInvitees: number;
  firstCall: string;
  lastCall: string;
};

// Group rows by primary host email (falling back to host name when the email
// is empty — Calendly sometimes returns no user_email for legacy members).
// Rows with multiple hosts still get attributed to the first membership, which
// matches how the per-host filter chip already works elsewhere.
function groupByHost(rows: Row[]): Group[] {
  const map = new Map<string, { hostName: string; hostEmail: string; bookings: Row[] }>();
  for (const r of rows) {
    const key = (r.hostEmail || r.hostName || `__unknown_${r.id}`).toLowerCase();
    if (!map.has(key)) {
      map.set(key, { hostName: r.hostName, hostEmail: r.hostEmail, bookings: [] });
    }
    map.get(key)!.bookings.push(r);
  }
  const out: Group[] = [];
  for (const [hostKey, g] of map.entries()) {
    const bookings = [...g.bookings].sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
    );
    const activeBookings = bookings.filter((b) => b.status === "active");
    const invitees = new Set(bookings.map((b) => b.inviteeEmail || b.id));
    out.push({
      hostKey,
      hostName: g.hostName || "—",
      hostEmail: g.hostEmail || "",
      bookings,
      totalCount: bookings.length,
      activeCount: activeBookings.length,
      canceledCount: bookings.length - activeBookings.length,
      uniqueInvitees: invitees.size,
      firstCall: bookings[bookings.length - 1].startTime,
      lastCall: bookings[0].startTime,
    });
  }
  // Most active first, then by recency.
  out.sort((a, b) => {
    if (b.activeCount !== a.activeCount) return b.activeCount - a.activeCount;
    return new Date(b.lastCall).getTime() - new Date(a.lastCall).getTime();
  });
  return out;
}

export function HostsTable({ rows, totalRows, matchedEventTypes, onInspect }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const groups = groupByHost(rows);
  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (groups.length === 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-border">
        <MatchedPills types={matchedEventTypes} />
        <div className="px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">No hosts match current filters</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <MatchedPills types={matchedEventTypes} />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <Th style={{ width: 30 }} />
              <Th>Host</Th>
              <Th>Email</Th>
              <Th align="center">Calls</Th>
              <Th>Status</Th>
              <Th align="center">Unique Invitees</Th>
              <Th>First Call</Th>
              <Th>Last Call</Th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const isOpen = expanded.has(g.hostKey);
              return (
                <FragmentGroup
                  key={g.hostKey}
                  group={g}
                  isOpen={isOpen}
                  onToggle={() => toggle(g.hostKey)}
                  onInspect={onInspect}
                />
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
        Showing {groups.length} hosts · {totalRows} total bookings
      </div>
    </div>
  );
}

function FragmentGroup({
  group: g,
  isOpen,
  onToggle,
  onInspect,
}: {
  group: Group;
  isOpen: boolean;
  onToggle: () => void;
  onInspect: (id: string) => void;
}) {
  const statusMix =
    g.activeCount > 0 && g.canceledCount > 0 ? (
      <>
        <Badge tone="green">{g.activeCount} active</Badge>{" "}
        <Badge tone="red">{g.canceledCount} canceled</Badge>
      </>
    ) : g.activeCount > 0 ? (
      <Badge tone="green">{g.activeCount} active</Badge>
    ) : (
      <Badge tone="red">{g.canceledCount} canceled</Badge>
    );

  return (
    <>
      <tr
        onClick={onToggle}
        className={
          "cursor-pointer border-b border-border/60 transition hover:bg-muted/40 " +
          (isOpen ? "bg-muted/40" : "")
        }
      >
        <td className="px-3 py-2.5">
          <span
            className={"inline-block transition-transform " + (isOpen ? "rotate-90" : "")}
            aria-hidden
          >
            ▶
          </span>
        </td>
        <td className="px-3 py-2.5 font-medium">{g.hostName}</td>
        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{g.hostEmail || "—"}</td>
        <td className="px-3 py-2.5 text-center">
          <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 font-mono text-xs">
            {g.totalCount}
          </span>
        </td>
        <td className="px-3 py-2.5">{statusMix}</td>
        <td className="px-3 py-2.5 text-center font-mono text-xs">{g.uniqueInvitees}</td>
        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-muted-foreground/80">
          {fmtDate(g.firstCall)}
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-muted-foreground/80">
          {fmtDate(g.lastCall)}
        </td>
      </tr>
      {isOpen ? (
        <tr>
          <td colSpan={8} className="bg-background/60 p-0">
            <table className="w-full text-sm">
              <tbody>
                {g.bookings.map((b, i) => (
                  <tr
                    key={b.id}
                    className="border-b border-border/40 last:border-b-0"
                  >
                    <td className="w-10 px-4 py-2 font-mono text-xs text-muted-foreground">
                      #{i + 1}
                    </td>
                    <td className="px-3 py-2 font-medium">{b.inviteeName}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {b.inviteeEmailDisplay}
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2" title={b.eventTypeName}>
                      {b.eventTypeName}
                    </td>
                    <td className="px-3 py-2">
                      {b.status === "active" ? (
                        <Badge tone="green">Active</Badge>
                      ) : (
                        <Badge tone="red">Canceled</Badge>
                      )}
                      {b.cancelReason ? (
                        <div className="mt-1 text-[10px] text-rose-700">↳ {b.cancelReason}</div>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-muted-foreground">
                      {fmtDate(b.startTime)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-muted-foreground/80">
                      Booked {fmtDate(b.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => onInspect(b.id)}
                        className="font-mono text-[11px] text-muted-foreground underline hover:text-accent"
                      >
                        view JSON
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function Th({
  children,
  align = "left",
  style,
}: {
  children?: React.ReactNode;
  align?: "left" | "center";
  style?: React.CSSProperties;
}) {
  return (
    <th
      style={style}
      className={
        "px-3 py-2.5 text-[11px] font-medium uppercase tracking-[0.07em] text-muted-foreground " +
        (align === "center" ? "text-center" : "text-left")
      }
    >
      {children}
    </th>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "green" | "red";
  children: React.ReactNode;
}) {
  const cls =
    tone === "green"
      ? "bg-emerald-500/10 text-emerald-700"
      : "bg-rose-500/10 text-rose-700";
  return (
    <span
      className={
        "inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.05em] " +
        cls
      }
    >
      {children}
    </span>
  );
}
