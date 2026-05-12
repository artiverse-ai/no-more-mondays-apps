"use client";

import { useMemo, useState } from "react";
import { CalendlyEventType, Row } from "../lib/types";
import { fmtDate } from "../lib/format";
import { MatchedPills } from "./MatchedPills";

const PAGE_SIZE = 15;

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
  ["internalNote", "Funnel"],
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
  const [page, setPage] = useState(1);

  // Reset to page 1 whenever the filtered set changes (status chip, sort,
  // host dropdown, etc.) — otherwise the user can land on an empty page.
  // React 19 pattern: derive the reset during render via a setState while
  // rendering, rather than an effect.
  const resetKey = `${rows.length}|${sortField}|${sortDir}|${rows[0]?.id ?? ""}`;
  const [prevKey, setPrevKey] = useState(resetKey);
  if (prevKey !== resetKey) {
    setPrevKey(resetKey);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, rows.length);
  const pageRows = useMemo(() => rows.slice(pageStart, pageEnd), [rows, pageStart, pageEnd]);

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
            {pageRows.map((r) => (
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
        <span>
          Showing {pageStart + 1}–{pageEnd} of {rows.length}
          {rows.length < total ? ` (of ${total} total)` : ""} · sorted by {sortField}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <PagerBtn
              disabled={safePage === 1}
              onClick={() => setPage(1)}
              aria-label="First page"
            >
              «
            </PagerBtn>
            <PagerBtn
              disabled={safePage === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              ‹
            </PagerBtn>
            <span className="px-2 font-mono tabular-nums">
              {safePage} / {totalPages}
            </span>
            <PagerBtn
              disabled={safePage === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next page"
            >
              ›
            </PagerBtn>
            <PagerBtn
              disabled={safePage === totalPages}
              onClick={() => setPage(totalPages)}
              aria-label="Last page"
            >
              »
            </PagerBtn>
          </div>
        )}
      </div>
    </div>
  );
}

function PagerBtn({
  disabled,
  onClick,
  children,
  ...rest
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-border bg-background px-2 py-0.5 font-mono text-xs text-foreground transition hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-30"
      {...rest}
    >
      {children}
    </button>
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

