"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Row } from "../lib/types";

const TZ = "America/New_York";
const MAX_COLS = 30;

const fmtDateKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const fmtHourKey = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hour: "2-digit",
  hour12: false,
});

const fmtColHeader = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  weekday: "short",
  month: "short",
  day: "numeric",
});

const fmtCellTime = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const fmtDialogDay = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

type CellKey = string; // `${date}|${hour}`
const cellKey = (date: string, hour: string): CellKey => `${date}|${hour}`;

// Heatmap of call volume by date × hour-of-day (Eastern Time). Only dates
// and hours that actually have bookings are shown — for a sparse 2-year
// horizon this collapses thousands of empty cells down to a useful grid.
// Click any cell to see the calls in that bucket.
export function CallHeatMatrix({
  rows,
  onInspect,
}: {
  rows: Row[];
  onInspect: (id: string) => void;
}) {
  const [openCell, setOpenCell] = useState<{
    date: string;
    hour: string;
    rows: Row[];
  } | null>(null);

  const { dateCols, hourRows, cellMap, rowTotals, colTotals, max, truncated } = useMemo(() => {
    const byCell = new Map<CellKey, Row[]>();
    const allDates = new Set<string>();
    const allHours = new Set<string>();
    for (const r of rows) {
      const d = new Date(r.startTime);
      if (Number.isNaN(d.getTime())) continue;
      const date = fmtDateKey.format(d);
      const hour = fmtHourKey.format(d);
      allDates.add(date);
      allHours.add(hour);
      const k = cellKey(date, hour);
      const arr = byCell.get(k) ?? [];
      arr.push(r);
      byCell.set(k, arr);
    }

    const sortedDates = [...allDates].sort();
    const truncated = sortedDates.length > MAX_COLS;
    const cols = truncated ? sortedDates.slice(0, MAX_COLS) : sortedDates;
    const colsSet = new Set(cols);
    const hours = [...allHours].sort();

    const cellMap = new Map<CellKey, Row[]>();
    for (const [k, v] of byCell) {
      const [date] = k.split("|");
      if (colsSet.has(date)) cellMap.set(k, v);
    }

    const rowTotals = new Map<string, number>();
    const colTotals = new Map<string, number>();
    let max = 0;
    for (const [k, v] of cellMap) {
      const [date, hour] = k.split("|");
      rowTotals.set(hour, (rowTotals.get(hour) ?? 0) + v.length);
      colTotals.set(date, (colTotals.get(date) ?? 0) + v.length);
      if (v.length > max) max = v.length;
    }

    return {
      dateCols: cols,
      hourRows: hours,
      cellMap,
      rowTotals,
      colTotals,
      max,
      truncated,
    };
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        No bookings in current filter. Loosen Status or Host above.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-border bg-card">
        <div className="flex items-baseline justify-between border-b border-border px-5 py-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Calendar heatmap
            </p>
            <h3 className="font-heading text-base font-semibold">
              Call volume by day &amp; hour (ET)
            </h3>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Click a cell to see the calls in that hour.
          </p>
        </div>

        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <div
              className="grid border-b border-border bg-secondary/30"
              style={{
                gridTemplateColumns: `64px repeat(${dateCols.length}, minmax(72px, 1fr)) 80px`,
              }}
            >
              <div className="border-r border-border px-2 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                hour
              </div>
              {dateCols.map((d) => {
                const parts = fmtColHeader.format(new Date(d + "T12:00:00Z")).split(",");
                return (
                  <div
                    key={d}
                    className="flex flex-col items-center justify-center border-l border-border px-1 py-2 text-center"
                  >
                    <span className="font-heading text-xs font-semibold tracking-tight">
                      {parts[0]}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {parts[1]?.trim()}
                    </span>
                  </div>
                );
              })}
              <div className="flex items-center justify-center border-l-2 border-foreground/30 bg-secondary/60 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
                Total
              </div>
            </div>

            <div
              className="grid border-b-2 border-foreground/30 bg-accent/5"
              style={{
                gridTemplateColumns: `64px repeat(${dateCols.length}, minmax(72px, 1fr)) 80px`,
              }}
            >
              <div className="flex items-center justify-end border-r border-border px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
                Total
              </div>
              {dateCols.map((d) => (
                <div
                  key={d}
                  className="flex items-center justify-center border-l border-border py-2 font-heading text-sm font-semibold tabular-nums"
                >
                  {colTotals.get(d) ?? 0}
                </div>
              ))}
              <div className="flex items-center justify-center border-l-2 border-foreground/30 bg-accent/15 py-2 font-heading text-base font-semibold tabular-nums text-accent">
                {rows.length}
              </div>
            </div>

            {hourRows.map((hour) => (
              <div
                key={hour}
                className="grid border-b border-border/60 last:border-0"
                style={{
                  gridTemplateColumns: `64px repeat(${dateCols.length}, minmax(72px, 1fr)) 80px`,
                }}
              >
                <div className="flex items-center justify-end border-r border-border px-2 py-2 font-mono text-[11px] tabular-nums text-muted-foreground">
                  {hour}:00
                </div>
                {dateCols.map((d) => {
                  const bucket = cellMap.get(cellKey(d, hour));
                  if (!bucket || bucket.length === 0) {
                    return (
                      <div
                        key={d}
                        className="border-l border-border bg-muted/10"
                      />
                    );
                  }
                  return (
                    <HeatCell
                      key={d}
                      count={bucket.length}
                      max={max}
                      onClick={() => setOpenCell({ date: d, hour, rows: bucket })}
                    />
                  );
                })}
                <div className="flex items-center justify-center border-l-2 border-foreground/30 bg-secondary/40 py-2 text-sm font-semibold tabular-nums">
                  {rowTotals.get(hour) ?? 0}
                </div>
              </div>
            ))}
          </div>
        </div>

        {truncated ? (
          <p className="border-t border-border bg-amber-500/10 px-5 py-2 text-[11px] text-amber-700">
            Showing first {MAX_COLS} days with bookings. Narrow the call-time
            range to focus on a tighter window.
          </p>
        ) : null}
      </div>

      <CellDialog
        cell={openCell}
        onClose={() => setOpenCell(null)}
        onInspect={(id) => {
          setOpenCell(null);
          onInspect(id);
        }}
      />
    </>
  );
}

function HeatCell({
  count,
  max,
  onClick,
}: {
  count: number;
  max: number;
  onClick: () => void;
}) {
  // Tint cells by relative density. Single-shade ramp using accent so it
  // reads as one calendar instead of red-vs-green which would suggest good
  // vs bad (volume is just volume).
  const intensity = max > 0 ? count / max : 0;
  let bg: string;
  let fg: string;
  if (intensity >= 0.8) {
    bg = "bg-accent text-background";
    fg = "";
  } else if (intensity >= 0.55) {
    bg = "bg-accent/75 text-background";
    fg = "";
  } else if (intensity >= 0.3) {
    bg = "bg-accent/55 text-background";
    fg = "";
  } else if (intensity >= 0.15) {
    bg = "bg-accent/30 text-foreground";
    fg = "";
  } else {
    bg = "bg-accent/15 text-foreground";
    fg = "";
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center border-l border-border py-2 text-sm transition hover:opacity-80 ${bg} ${fg}`}
    >
      <span className="font-semibold tabular-nums">{count}</span>
    </button>
  );
}

function CellDialog({
  cell,
  onClose,
  onInspect,
}: {
  cell: { date: string; hour: string; rows: Row[] } | null;
  onClose: () => void;
  onInspect: (id: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (cell) {
      if (!dlg.open) dlg.showModal();
    } else {
      if (dlg.open) dlg.close();
    }
  }, [cell]);

  if (!cell) return null;

  const sorted = [...cell.rows].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );
  const active = sorted.filter((r) => r.status === "active").length;
  const canceled = sorted.length - active;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-auto w-full max-w-xl rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-foreground/40 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-accent">
            {cell.hour}:00 ET
          </span>
          <h3 className="font-heading text-xl font-semibold leading-snug">
            {sorted.length} call{sorted.length === 1 ? "" : "s"} ·{" "}
            <span className="text-emerald-700">{active} active</span>
            {canceled > 0 && (
              <>
                {" "}
                · <span className="text-rose-700">{canceled} canceled</span>
              </>
            )}
          </h3>
          <p className="text-xs text-muted-foreground">
            {fmtDialogDay.format(new Date(cell.date + "T12:00:00Z"))}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Close"
        >
          <span aria-hidden className="text-lg leading-none">
            ×
          </span>
        </button>
      </div>

      <ul className="max-h-[60vh] divide-y divide-border/60 overflow-y-auto">
        {sorted.map((r) => (
          <li key={r.id} className="px-6 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{r.inviteeName}</span>
                  {r.status === "canceled" ? (
                    <Badge tone="red">Canceled</Badge>
                  ) : (
                    <Badge tone="green">Active</Badge>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {r.inviteeEmailDisplay}
                </p>
                <p
                  className="mt-1 truncate text-xs text-foreground/80"
                  title={r.eventTypeName}
                >
                  {r.eventTypeName}
                </p>
                <p className="mt-0.5 text-xs">
                  <span className="text-muted-foreground">Host:</span>{" "}
                  <span className="font-medium">{r.hostName}</span>
                  <span className="mx-1.5 text-border">·</span>
                  <span className="text-muted-foreground">Funnel:</span>{" "}
                  <span className="font-mono text-[11px]">
                    {r.internalNote || "—"}
                  </span>
                </p>
                {r.cancelReason ? (
                  <p className="mt-1 text-[10px] text-rose-700">
                    ↳ {r.cancelReason}
                  </p>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-xs font-medium text-foreground">
                  {fmtCellTime.format(new Date(r.startTime))} ET
                </p>
                <button
                  type="button"
                  onClick={() => onInspect(r.id)}
                  className="mt-1 font-mono text-[11px] text-muted-foreground underline hover:text-accent"
                >
                  view JSON
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </dialog>
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
        "inline-flex items-center rounded px-1.5 py-0 text-[10px] font-medium uppercase tracking-[0.05em] " +
        cls
      }
    >
      {children}
    </span>
  );
}
