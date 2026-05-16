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
  email: string;
  emailKey: string;
  name: string;
  bookings: Row[];
  totalCount: number;
  activeCount: number;
  canceledCount: number;
  hostList: string[];
  firstBooked: string;
  lastBooked: string;
  isDoubleBooked: boolean;
  isMultiHost: boolean;
};

function groupByInvitee(rows: Row[]): Group[] {
  const map = new Map<string, { email: string; emailKey: string; name: string; bookings: Row[] }>();
  for (const r of rows) {
    const key = r.inviteeEmail || `__no_email_${r.id}`;
    if (!map.has(key)) {
      map.set(key, { email: r.inviteeEmailDisplay, emailKey: key, name: r.inviteeName, bookings: [] });
    }
    map.get(key)!.bookings.push(r);
  }
  const out: Group[] = [];
  for (const g of map.values()) {
    const bookings = [...g.bookings].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const activeBookings = bookings.filter((b) => b.status === "active");
    const uniqueActiveHosts = new Set(
      activeBookings
        .flatMap((b) => (b.hostNames.length ? b.hostNames : [b.hostName]))
        .filter((h) => h && h !== "—"),
    );
    const allUniqueHosts = new Set(
      bookings
        .flatMap((b) => (b.hostNames.length ? b.hostNames : [b.hostName]))
        .filter((h) => h && h !== "—"),
    );
    out.push({
      ...g,
      bookings,
      totalCount: bookings.length,
      activeCount: activeBookings.length,
      canceledCount: bookings.length - activeBookings.length,
      hostList: [...allUniqueHosts],
      firstBooked: bookings[bookings.length - 1].createdAt,
      lastBooked: bookings[0].createdAt,
      isDoubleBooked: activeBookings.length >= 2 && uniqueActiveHosts.size >= 2,
      isMultiHost:
        allUniqueHosts.size >= 2 &&
        !(activeBookings.length >= 2 && uniqueActiveHosts.size >= 2),
    });
  }
  out.sort((a, b) => {
    if (a.isDoubleBooked !== b.isDoubleBooked) return a.isDoubleBooked ? -1 : 1;
    return new Date(b.lastBooked).getTime() - new Date(a.lastBooked).getTime();
  });
  return out;
}

export function InviteesTable({ rows, totalRows, matchedEventTypes, onInspect }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const groups = groupByInvitee(rows);
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
          <p className="text-sm text-muted-foreground">No invitees match current filters</p>
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
              <Th>Invitee</Th>
              <Th>Email</Th>
              <Th align="center">Bookings</Th>
              <Th>Status</Th>
              <Th>Hosts</Th>
              <Th>First Booked</Th>
              <Th>Last Booked</Th>
              <Th>Flag</Th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const isOpen = expanded.has(g.emailKey);
              return (
                <FragmentGroup
                  key={g.emailKey}
                  group={g}
                  isOpen={isOpen}
                  onToggle={() => toggle(g.emailKey)}
                  onInspect={onInspect}
                />
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
        Showing {groups.length} unique invitees · {totalRows} total bookings
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
  const hostsDisplay =
    g.hostList.length === 1 ? (
      <>{g.hostList[0]}</>
    ) : (
      <span title={g.hostList.join(", ")}>
        {g.hostList[0]}{" "}
        <span className="text-xs text-muted-foreground">+{g.hostList.length - 1}</span>
      </span>
    );
  const flag = g.isDoubleBooked ? (
    <Badge tone="red-strong">⚠ Double Booked</Badge>
  ) : g.isMultiHost ? (
    <Badge tone="amber-strong">Multi-Host</Badge>
  ) : null;

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
        <td className="px-3 py-2.5 font-medium">{g.name}</td>
        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{g.email}</td>
        <td className="px-3 py-2.5 text-center">
          <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 font-mono text-xs">
            {g.totalCount}
          </span>
        </td>
        <td className="px-3 py-2.5">{statusMix}</td>
        <td className="px-3 py-2.5">{hostsDisplay}</td>
        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-muted-foreground/80">
          {fmtDate(g.firstBooked)}
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-muted-foreground/80">
          {fmtDate(g.lastBooked)}
        </td>
        <td className="px-3 py-2.5">{flag}</td>
      </tr>
      {isOpen ? (
        <tr>
          <td colSpan={9} className="bg-background/60 p-0">
            <table className="w-full text-sm">
              <tbody>
                {[...g.bookings]
                  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                  .map((b, i, arr) => {
                    const activeHosts = new Set(
                      arr.filter((x) => x.status === "active").map((x) => x.hostName),
                    );
                    const isConflict = b.status === "active" && activeHosts.size >= 2;
                    return (
                      <tr
                        key={b.id}
                        className={
                          "border-b border-border/40 last:border-b-0 " +
                          (isConflict ? "bg-rose-500/5" : "")
                        }
                      >
                        <td className="w-10 px-4 py-2 font-mono text-xs text-muted-foreground">
                          #{i + 1}
                        </td>
                        <td className="max-w-[220px] truncate px-3 py-2" title={b.eventTypeName}>
                          {b.eventTypeName}
                        </td>
                        <td className="px-3 py-2 text-foreground/80" title={b.allHosts}>
                          {b.hostCount > 1 ? b.allHosts : b.hostName}
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
                    );
                  })}
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
  tone: "green" | "red" | "red-strong" | "amber-strong";
  children: React.ReactNode;
}) {
  const cls =
    tone === "green"
      ? "bg-emerald-500/10 text-emerald-700"
      : tone === "red"
      ? "bg-rose-500/10 text-rose-700"
      : tone === "red-strong"
      ? "border border-rose-500/40 bg-rose-500/15 text-rose-700"
      : "border border-amber-500/35 bg-amber-500/15 text-amber-700";
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
