"use client";

import { CalendlyEventType, Row } from "../lib/types";
import { fmtDate } from "../lib/format";
import { MatchedPills } from "./MatchedPills";

type SortField =
  | "inviteeName"
  | "inviteeEmail"
  | "status"
  | "eventTypeName"
  | "internalNote"
  | "hostName"
  | "startTime"
  | "createdAt";

const COLS: [SortField, string][] = [
  ["inviteeName", "Invitee"],
  ["inviteeEmail", "Email"],
  ["status", "Status"],
  ["eventTypeName", "Event Type"],
  ["internalNote", "Internal Note"],
  ["hostName", "Host"],
  ["startTime", "Call Time"],
  ["createdAt", "Booked At"],
];

type Props = {
  rows: Row[];
  total: number;
  sortField: SortField;
  sortDir: "asc" | "desc";
  onSort: (f: SortField) => void;
  matchedEventTypes: CalendlyEventType[];
  onInspect: (id: string) => void;
};

export function BookingsTable({
  rows,
  total,
  sortField,
  sortDir,
  onSort,
  matchedEventTypes,
  onInspect,
}: Props) {
  if (rows.length === 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-border">
        <MatchedPills types={matchedEventTypes} />
        <div className="px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {matchedEventTypes.length === 0
              ? "No event types matched your internal note query"
              : "No bookings on matched event types in this date range"}
          </p>
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
              {COLS.map(([field, label]) => {
                const isActive = sortField === field;
                const arrow = isActive ? (sortDir === "asc" ? "▲" : "▼") : "⇅";
                return (
                  <th
                    key={field}
                    onClick={() => onSort(field)}
                    className={
                      "cursor-pointer whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-[0.07em] transition hover:text-accent " +
                      (isActive ? "text-accent" : "text-muted-foreground")
                    }
                  >
                    {label}{" "}
                    <span className={"ml-1 text-[10px] " + (isActive ? "opacity-100" : "opacity-30")}>
                      {arrow}
                    </span>
                  </th>
                );
              })}
              <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
                Inspect
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/60 last:border-b-0 hover:bg-muted/40">
                <td className="px-3 py-2.5 font-medium">{r.inviteeName}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{r.inviteeEmailDisplay}</td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={r.status} />
                  {r.cancelReason ? (
                    <div className="mt-1 text-[10px] text-rose-700">↳ {r.cancelReason}</div>
                  ) : null}
                </td>
                <td
                  className="max-w-[220px] truncate px-3 py-2.5 text-muted-foreground"
                  title={r.eventTypeName}
                >
                  {r.eventTypeName}
                </td>
                <td
                  className="max-w-[240px] truncate px-3 py-2.5 font-mono text-xs text-amber-700"
                  title={r.internalNote}
                >
                  {r.internalNote}
                </td>
                <td className="px-3 py-2.5 text-foreground/80" title={r.allHosts}>
                  {r.hostCount > 1 ? r.allHosts : r.hostName}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-muted-foreground">
                  {fmtDate(r.startTime)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-muted-foreground/80">
                  {fmtDate(r.createdAt)}
                </td>
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => onInspect(r.id)}
                    className="font-mono text-[11px] text-muted-foreground underline hover:text-accent"
                  >
                    view JSON
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-border bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
        <span>
          Showing {rows.length} of {total} matched bookings · sorted by {sortField}
        </span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "active" | "canceled" }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-700">
      Canceled
    </span>
  );
}

