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

type StatusFilter = "all" | "active" | "canceled";

// Heatmap of call volume by date × hour-of-day (Eastern Time). Each cell is
// split vertically into active (green, top) and canceled (red, bottom),
// proportional to the bucket's mix. Clicking a colored part:
//   1. Filters the whole dashboard to that status (so the other color
//      vanishes from every cell since the upstream filter removes those rows)
//   2. Opens the detail modal with the clicked status's calls in that bucket
// Clicking the same colored part again toggles the filter back to "all".
export function CallHeatMatrix({
  rows,
  statusFilter,
  setStatusFilter,
  onInspect,
}: {
  rows: Row[];
  statusFilter: StatusFilter;
  setStatusFilter: (s: StatusFilter) => void;
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
          <div className="flex flex-col items-end gap-1 text-[10px] text-muted-foreground">
            <p>Click <span className="text-emerald-700">green</span> to filter to Active · <span className="text-rose-700">red</span> to Canceled</p>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-3 rounded-sm bg-emerald-500/80" />
                Active
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-3 rounded-sm bg-rose-500/80" />
                Canceled
              </span>
            </div>
          </div>
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
                  const activeCount = bucket.filter((r) => r.status === "active").length;
                  const canceledCount = bucket.length - activeCount;
                  return (
                    <HeatCell
                      key={d}
                      activeCount={activeCount}
                      canceledCount={canceledCount}
                      max={max}
                      statusFilter={statusFilter}
                      onClickStatus={(status) => {
                        // Toggle: clicking the currently-active status restores "all".
                        setStatusFilter(statusFilter === status ? "all" : status);
                        const subset = bucket.filter((r) => r.status === status);
                        if (subset.length > 0) {
                          setOpenCell({ date: d, hour, rows: subset });
                        }
                      }}
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
  activeCount,
  canceledCount,
  max,
  statusFilter,
  onClickStatus,
}: {
  activeCount: number;
  canceledCount: number;
  max: number;
  statusFilter: StatusFilter;
  onClickStatus: (status: "active" | "canceled") => void;
}) {
  const total = activeCount + canceledCount;
  const intensity = max > 0 ? total / max : 0;
  // Lower-volume cells fade; busy cells stay vivid. Same idea as the prior
  // single-color ramp, but on the active/canceled colors.
  const alpha = 0.45 + 0.55 * Math.min(intensity, 1);
  const activeBg = `rgba(22, 163, 74, ${alpha})`; // emerald-600
  const canceledBg = `rgba(220, 38, 38, ${alpha})`; // red-600

  return (
    <div className="relative flex min-h-[40px] flex-col border-l border-border">
      {activeCount > 0 ? (
        <button
          type="button"
          onClick={() => onClickStatus("active")}
          style={{ flex: activeCount, backgroundColor: activeBg }}
          className={
            "transition hover:brightness-110 focus:outline-none focus:brightness-110 " +
            (statusFilter === "active"
              ? "ring-1 ring-inset ring-emerald-900/40"
              : "")
          }
          title={`${activeCount} active · click to filter`}
          aria-label={`${activeCount} active calls`}
        />
      ) : null}
      {canceledCount > 0 ? (
        <button
          type="button"
          onClick={() => onClickStatus("canceled")}
          style={{ flex: canceledCount, backgroundColor: canceledBg }}
          className={
            "transition hover:brightness-110 focus:outline-none focus:brightness-110 " +
            (statusFilter === "canceled"
              ? "ring-1 ring-inset ring-rose-900/40"
              : "")
          }
          title={`${canceledCount} canceled · click to filter`}
          aria-label={`${canceledCount} canceled calls`}
        />
      ) : null}
      <span
        className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[11px] font-semibold tabular-nums text-foreground"
        style={{ textShadow: "0 0 3px rgba(255,255,255,0.85)" }}
      >
        {activeCount > 0 && canceledCount > 0 ? (
          <>
            <span className="text-emerald-900">{activeCount}</span>
            <span className="mx-0.5 opacity-50">·</span>
            <span className="text-rose-900">{canceledCount}</span>
          </>
        ) : (
          total
        )}
      </span>
    </div>
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
