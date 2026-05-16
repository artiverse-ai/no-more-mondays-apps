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

type StatusSplit = { active: number; canceled: number };

type StatusFilter = "all" | "active" | "canceled";

// Heatmap of call volume by date × hour-of-day (Eastern Time). Cells split
// left/right: green = active calls, red = canceled, widths proportional to
// the mix. Click is read-only: clicking the green half opens a modal with
// the bucket's active calls; clicking red opens with the canceled. The
// dashboard-level filters (Status chips up top) are the only way to filter
// globally — the heatmap never mutates them.
export function CallHeatMatrix({
  rows,
  statusFilter,
  onInspect,
}: {
  rows: Row[];
  statusFilter: StatusFilter;
  onInspect: (id: string) => void;
}) {
  const [openCell, setOpenCell] = useState<{
    date: string;
    hour: string;
    rows: Row[];
  } | null>(null);

  const { dateCols, hourRows, cellMap, rowTotals, colTotals, rowRows, colRows, grandRows, grandActive, grandCanceled, max, truncated } = useMemo(() => {
    const byCell = new Map<CellKey, Row[]>();
    const allDates = new Set<string>();
    const allHours = new Set<string>();
    // Bucket by booking CREATION time (when the user clicked Book) so the
    // heatmap surfaces booking-rush hours, not call-delivery hours.
    for (const r of rows) {
      const d = new Date(r.createdAt);
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

    const rowTotals = new Map<string, StatusSplit>();
    const colTotals = new Map<string, StatusSplit>();
    const rowRows = new Map<string, Row[]>(); // hour → all rows for that hour
    const colRows = new Map<string, Row[]>(); // date → all rows for that date
    const grandRows: Row[] = [];
    let grandActive = 0;
    let grandCanceled = 0;
    let max = 0;
    for (const [k, v] of cellMap) {
      const [date, hour] = k.split("|");
      const a = v.filter((r) => r.status === "active").length;
      const c = v.length - a;
      const rT = rowTotals.get(hour) ?? { active: 0, canceled: 0 };
      rT.active += a;
      rT.canceled += c;
      rowTotals.set(hour, rT);
      const cT = colTotals.get(date) ?? { active: 0, canceled: 0 };
      cT.active += a;
      cT.canceled += c;
      colTotals.set(date, cT);
      const rR = rowRows.get(hour) ?? [];
      rR.push(...v);
      rowRows.set(hour, rR);
      const cR = colRows.get(date) ?? [];
      cR.push(...v);
      colRows.set(date, cR);
      grandRows.push(...v);
      grandActive += a;
      grandCanceled += c;
      if (v.length > max) max = v.length;
    }

    return {
      dateCols: cols,
      hourRows: hours,
      cellMap,
      rowTotals,
      colTotals,
      rowRows,
      colRows,
      grandRows,
      grandActive,
      grandCanceled,
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
            <p>Click a colored half to see those calls in detail.</p>
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
              {dateCols.map((d) => {
                const t = colTotals.get(d) ?? { active: 0, canceled: 0 };
                return (
                  <div key={d} className="border-l border-border p-0">
                    <TotalSplit
                      active={t.active}
                      canceled={t.canceled}
                      emphasis="md"
                      rows={colRows.get(d) ?? []}
                      label={{ date: d, hour: "All hours" }}
                      onOpen={setOpenCell}
                    />
                  </div>
                );
              })}
              <div className="border-l-2 border-foreground/30 bg-accent/10 p-0">
                <TotalSplit
                  active={grandActive}
                  canceled={grandCanceled}
                  emphasis="lg"
                  rows={grandRows}
                  label={{ date: "All dates", hour: "All hours" }}
                  onOpen={setOpenCell}
                />
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
                        // Click is read-only — never changes the dashboard
                        // status filter. It just opens the detail modal for
                        // the clicked sub-section: green half → that hour's
                        // active calls; red half → that hour's canceled
                        // calls. The top-bar Status chips remain the only
                        // way to filter globally.
                        const subset = bucket.filter((r) => r.status === status);
                        if (subset.length > 0) {
                          setOpenCell({ date: d, hour, rows: subset });
                        }
                      }}
                    />
                  );
                })}
                <div className="border-l-2 border-foreground/30 bg-secondary/30 p-0">
                  {(() => {
                    const t = rowTotals.get(hour) ?? { active: 0, canceled: 0 };
                    return (
                      <TotalSplit
                        active={t.active}
                        canceled={t.canceled}
                        emphasis="sm"
                        rows={rowRows.get(hour) ?? []}
                        label={{ date: "All dates", hour }}
                        onOpen={setOpenCell}
                      />
                    );
                  })()}
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
    <div className="flex min-h-[40px] flex-row border-l border-border">
      {activeCount > 0 ? (
        <button
          type="button"
          onClick={() => onClickStatus("active")}
          style={{ flex: activeCount, backgroundColor: activeBg }}
          className={
            "flex h-full items-center justify-center overflow-hidden font-mono text-[11px] font-semibold tabular-nums text-emerald-950 transition hover:brightness-110 focus:outline-none focus:brightness-110 " +
            (statusFilter === "active"
              ? "ring-1 ring-inset ring-emerald-900/40"
              : "")
          }
          title={`${activeCount} active · click to inspect`}
          aria-label={`${activeCount} active calls`}
        >
          {activeCount}
        </button>
      ) : null}
      {canceledCount > 0 ? (
        <button
          type="button"
          onClick={() => onClickStatus("canceled")}
          style={{ flex: canceledCount, backgroundColor: canceledBg }}
          className={
            "flex h-full items-center justify-center overflow-hidden font-mono text-[11px] font-semibold tabular-nums text-rose-950 transition hover:brightness-110 focus:outline-none focus:brightness-110 " +
            (statusFilter === "canceled"
              ? "ring-1 ring-inset ring-rose-900/40"
              : "")
          }
          title={`${canceledCount} canceled · click to filter`}
          aria-label={`${canceledCount} canceled calls`}
        >
          {canceledCount}
        </button>
      ) : null}
    </div>
  );
}

// Same active/canceled split treatment as HeatCell, used in the column- and
// row-totals + grand total. Each colored region is clickable; clicking opens
// the cell modal with the corresponding status subset of the supplied rows.
// Read-only — never changes dashboard filters.
function TotalSplit({
  active,
  canceled,
  emphasis,
  rows,
  label,
  onOpen,
}: {
  active: number;
  canceled: number;
  emphasis: "sm" | "md" | "lg";
  rows: Row[];
  label: { date: string; hour: string };
  onOpen: (cell: { date: string; hour: string; rows: Row[] }) => void;
}) {
  const total = active + canceled;
  if (total === 0) {
    return (
      <div className="flex h-full items-center justify-center py-2 text-muted-foreground/40">
        —
      </div>
    );
  }
  const sizeCls =
    emphasis === "lg"
      ? "text-base font-heading font-semibold py-2"
      : emphasis === "md"
      ? "text-sm font-heading font-semibold py-2"
      : "text-xs font-mono font-semibold py-2";

  const handle = (status: "active" | "canceled") => {
    const subset = rows.filter((r) => r.status === status);
    if (subset.length > 0) onOpen({ ...label, rows: subset });
  };

  return (
    <div className="flex h-full min-h-[36px] flex-row">
      {active > 0 ? (
        <button
          type="button"
          onClick={() => handle("active")}
          style={{ flex: active, backgroundColor: "rgba(22, 163, 74, 0.8)" }}
          className={`flex items-center justify-center text-emerald-950 tabular-nums transition hover:brightness-110 focus:outline-none focus:brightness-110 ${sizeCls}`}
          title={`${active} active · click to see details`}
        >
          {active}
        </button>
      ) : null}
      {canceled > 0 ? (
        <button
          type="button"
          onClick={() => handle("canceled")}
          style={{ flex: canceled, backgroundColor: "rgba(220, 38, 38, 0.8)" }}
          className={`flex items-center justify-center text-rose-950 tabular-nums transition hover:brightness-110 focus:outline-none focus:brightness-110 ${sizeCls}`}
          title={`${canceled} canceled · click to see details`}
        >
          {canceled}
        </button>
      ) : null}
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
