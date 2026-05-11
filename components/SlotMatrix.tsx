"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { RangeSlot } from "@/lib/availability";

const shortName = (email: string) => email.split("@")[0];

export function SlotMatrix({
  slots,
  totalMembers,
  tz,
  durationMin,
}: {
  slots: RangeSlot[];
  totalMembers: number;
  tz: string;
  durationMin: number;
}) {
  const [selected, setSelected] = useState<RangeSlot | null>(null);

  const fmtSlot = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  });
  const fmtDay = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: tz,
  });

  // Build matrix: rows = unique slot times (HH:mm in TZ), cols = unique dates
  const colKey = (s: RangeSlot) => s.slot_date;
  const rowKey = (s: RangeSlot) => fmtSlot.format(new Date(s.slot_start));

  const cols = Array.from(new Set(slots.map(colKey))).sort();
  const rows = Array.from(new Set(slots.map(rowKey))).sort();

  const lookup = new Map<string, RangeSlot>();
  for (const s of slots) lookup.set(`${colKey(s)}|${rowKey(s)}`, s);

  // Totals = total team capacity (sum of free closers across slots). Multiple
  // closers free in the same slot can take parallel calls, so each one counts.
  const rowTotals = new Map<string, number>();
  const colTotals = new Map<string, number>();
  let grandTotal = 0;
  for (const s of slots) {
    rowTotals.set(rowKey(s), (rowTotals.get(rowKey(s)) || 0) + s.available_count);
    colTotals.set(colKey(s), (colTotals.get(colKey(s)) || 0) + s.available_count);
    grandTotal += s.available_count;
  }

  if (slots.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
        No slots in window. Try widening the date range.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Header row: dates + Total column */}
            <div
              className="grid border-b border-border bg-secondary/30"
              style={{ gridTemplateColumns: `90px repeat(${cols.length}, minmax(110px, 1fr)) 110px` }}
            >
              <div className="border-r border-border px-3 py-3 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                slot
              </div>
              {cols.map((c) => {
                const dayLabel = fmtDay.format(new Date(c + "T12:00:00Z"));
                return (
                  <div
                    key={c}
                    className="flex flex-col items-center justify-center border-l border-border px-2 py-3 text-center"
                  >
                    <span className="font-heading text-sm font-semibold tracking-tight">
                      {dayLabel.split(",")[0]}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {dayLabel.split(",")[1]?.trim()}
                    </span>
                  </div>
                );
              })}
              <div className="flex flex-col items-center justify-center border-l-2 border-foreground/30 bg-secondary/60 px-2 py-3 text-center">
                <span className="font-heading text-sm font-semibold tracking-tight">
                  Total
                </span>
                <span className="text-[10px] text-muted-foreground">per slot</span>
              </div>
            </div>

            {/* Top totals row: column totals + grand total (kept at the top so the
                headline numbers are visible without scrolling). */}
            <div
              className="grid border-b-2 border-foreground/30 bg-accent/5"
              style={{ gridTemplateColumns: `90px repeat(${cols.length}, minmax(110px, 1fr)) 110px` }}
            >
              <div className="flex items-center justify-end border-r border-border px-3 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
                Total
              </div>
              {cols.map((c) => (
                <div
                  key={c}
                  className="flex items-center justify-center border-l border-border py-3 font-heading text-lg font-semibold tabular-nums text-foreground"
                >
                  {colTotals.get(c) ?? 0}
                </div>
              ))}
              <div className="flex items-center justify-center border-l-2 border-foreground/30 bg-accent/15 py-3 font-heading text-2xl font-semibold tabular-nums text-accent">
                {grandTotal}
              </div>
            </div>

            {/* Body rows: slot time × date + row total */}
            {rows.map((rowTime) => (
              <div
                key={rowTime}
                className="grid border-b border-border/60 last:border-0"
                style={{ gridTemplateColumns: `90px repeat(${cols.length}, minmax(110px, 1fr)) 110px` }}
              >
                <div className="flex items-center justify-end border-r border-border px-3 py-3 font-mono text-xs tabular-nums text-muted-foreground">
                  {rowTime}
                </div>
                {cols.map((c) => {
                  const cell = lookup.get(`${c}|${rowTime}`);
                  if (!cell) {
                    return (
                      <div
                        key={c}
                        className="border-l border-border bg-muted/20"
                      />
                    );
                  }
                  return <Cell key={c} slot={cell} totalMembers={totalMembers} onClick={() => setSelected(cell)} />;
                })}
                <div className="flex items-center justify-center border-l-2 border-foreground/30 bg-secondary/40 py-2.5 text-base font-semibold tabular-nums">
                  {rowTotals.get(rowTime) ?? 0}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5 border-t border-border bg-secondary/15 px-5 py-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-3 w-4 rounded-sm bg-[#15803d]" />
            <span>all free</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-3 w-4 rounded-sm bg-[#65a30d]" />
            <span>most free</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-3 w-4 rounded-sm bg-[#eab308]" />
            <span>about half</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-3 w-4 rounded-sm bg-[#f97316]" />
            <span>few free</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-3 w-4 rounded-sm bg-[#dc2626]" />
            <span>none free</span>
          </span>
          <span className="ml-auto hidden text-[11px] sm:inline">
            click a cell to see who&apos;s free
          </span>
        </div>
      </div>

      <SlotCellDialog
        slot={selected}
        onClose={() => setSelected(null)}
        tz={tz}
        durationMin={durationMin}
        totalMembers={totalMembers}
      />
    </>
  );
}

function Cell({
  slot,
  totalMembers,
  onClick,
}: {
  slot: RangeSlot;
  totalMembers: number;
  onClick: () => void;
}) {
  const ratio = totalMembers > 0 ? slot.available_count / totalMembers : 0;
  // Green-to-red gradient: more free closers = greener, fewer = redder.
  // Bands tuned for 6-8 closer pools so 6/6 stays vivid green.
  let tone: string;
  if (slot.available_count === 0) {
    tone = "bg-[#dc2626] hover:bg-[#b91c1c] text-white";
  } else if (ratio >= 0.99) {
    tone = "bg-[#15803d] hover:bg-[#166534] text-white";
  } else if (ratio >= 0.75) {
    tone = "bg-[#65a30d] hover:bg-[#4d7c0f] text-white";
  } else if (ratio >= 0.5) {
    tone = "bg-[#eab308] hover:bg-[#ca8a04] text-foreground";
  } else if (ratio >= 0.25) {
    tone = "bg-[#f97316] hover:bg-[#ea580c] text-white";
  } else {
    tone = "bg-[#ef4444] hover:bg-[#dc2626] text-white";
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-0.5 border-l border-border py-2.5 text-sm transition-colors ${tone}`}
    >
      <span className="text-base font-semibold tabular-nums">
        {slot.available_count}
      </span>
      <span className="text-[10px] uppercase tracking-wider opacity-80">
        of {totalMembers}
      </span>
    </button>
  );
}

function SlotCellDialog({
  slot,
  onClose,
  tz,
  durationMin,
  totalMembers,
}: {
  slot: RangeSlot | null;
  onClose: () => void;
  tz: string;
  durationMin: number;
  totalMembers: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (slot) {
      if (!dlg.open) dlg.showModal();
    } else {
      if (dlg.open) dlg.close();
    }
  }, [slot]);

  if (!slot) return null;

  const fmtTime = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  });
  const fmtDay = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: tz,
  });

  const start = new Date(slot.slot_start);
  const end = new Date(slot.slot_end);
  const busyCount = totalMembers - slot.available_count;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-auto w-full max-w-md rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-foreground/40 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-accent">
            {fmtTime.format(start)} – {fmtTime.format(end)} ({durationMin}m)
          </span>
          <h3 className="font-heading text-xl font-semibold leading-snug">
            {slot.available_count} of {totalMembers} closers free
          </h3>
          <p className="text-xs text-muted-foreground">
            {fmtDay.format(start)} &middot; {tz}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Close"
        >
          <span aria-hidden className="text-lg leading-none">×</span>
        </button>
      </div>

      <div className="px-6 py-5">
        {slot.available_emails.length === 0 ? (
          <p className="text-sm text-muted-foreground">Every closer is busy in this slot.</p>
        ) : (
          <>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Free closers &middot; click a name to open their week
            </p>
            <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {slot.available_emails.map((email) => (
                <li key={email}>
                  <Link
                    href={`/apps/calendar/team/${encodeURIComponent(email)}?date=${slot.slot_date}&tz=${encodeURIComponent(tz)}`}
                    className="group flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm transition-colors hover:border-foreground/40 hover:bg-secondary"
                  >
                    <span className="truncate font-medium">{shortName(email)}</span>
                    <span className="text-[11px] text-muted-foreground transition-colors group-hover:text-foreground">
                      view week →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        {busyCount > 0 ? (
          <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
            {busyCount} closer{busyCount === 1 ? " is" : "s are"} booked in this slot.
          </p>
        ) : null}
      </div>
    </dialog>
  );
}
