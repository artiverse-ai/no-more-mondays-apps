"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { RangeSlot } from "@/lib/availability";

const shortName = (email: string) => email.split("@")[0];

export function HeadlineKPIs({
  slots,
  members,
  effectiveTeamSize,
  fromDate,
  toDate,
  rangeLabel,
  tz,
}: {
  slots: RangeSlot[];
  members: string[];
  effectiveTeamSize: number;
  fromDate: string;
  toDate: string;
  rangeLabel: string;
  tz: string;
}) {
  const [openDialog, setOpenDialog] = useState<"calls" | "closers" | null>(null);
  // Total bookable calls = sum of free closers across all slots, since
  // multiple closers can take simultaneous calls in the same time slot.
  const bookableSlots = slots.reduce((acc, s) => acc + s.available_count, 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenDialog("calls")}
        className="group flex w-full flex-wrap items-baseline justify-between gap-4 rounded-2xl border border-border bg-card p-6 text-left shadow-sm transition-colors hover:border-foreground/40 hover:bg-secondary/30"
      >
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">
            {rangeLabel} &middot; {effectiveTeamSize} closer{effectiveTeamSize === 1 ? "" : "s"}
          </p>
          <h2 className="mt-2 font-heading text-5xl font-semibold tabular-nums text-foreground md:text-6xl">
            {bookableSlots}
            <span className="ml-3 align-middle text-xl font-medium text-muted-foreground">
              slots available
            </span>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            click for the full list (exportable)
          </p>
        </div>
        <span className="text-xl text-muted-foreground transition-colors group-hover:text-foreground">
          ↗
        </span>
      </button>

      <BookableSlotsDialog
        open={openDialog === "calls"}
        onClose={() => setOpenDialog(null)}
        slots={slots.filter((s) => s.available_count > 0)}
        tz={tz}
        rangeLabel={rangeLabel}
      />
      <ClosersDialog
        open={openDialog === "closers"}
        onClose={() => setOpenDialog(null)}
        members={members}
        fromDate={fromDate}
        toDate={toDate}
        slots={slots}
        tz={tz}
      />
    </>
  );
}

function ClickableStat({
  label,
  value,
  sub,
  accent,
  onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-colors hover:border-foreground/40 hover:bg-secondary/30"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </div>
        <span className="text-[11px] text-muted-foreground transition-colors group-hover:text-foreground">
          ↗
        </span>
      </div>
      <div
        className={`mt-2 font-heading text-3xl font-semibold tabular-nums ${
          accent ? "text-accent" : "text-foreground"
        }`}
      >
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
    </button>
  );
}

function downloadCsv(rows: string[][], filename: string) {
  const escape = (v: string) => {
    if (/[",\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
    return v;
  };
  const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function BookableSlotsDialog({
  open,
  onClose,
  slots,
  tz,
  rangeLabel,
}: {
  open: boolean;
  onClose: () => void;
  slots: RangeSlot[];
  tz: string;
  rangeLabel: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open) {
      if (!dlg.open) dlg.showModal();
    } else {
      if (dlg.open) dlg.close();
    }
  }, [open]);

  const fmtDate = new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: tz,
  });
  const fmtTime = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz,
  });
  const fmtIsoDate = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: tz,
  });

  const exportCsv = () => {
    const header = ["date", "weekday", "start_time", "end_time", "free_closer_count", "free_closers"];
    const rows = slots.map((s) => {
      const start = new Date(s.slot_start);
      const end = new Date(s.slot_end);
      return [
        fmtIsoDate.format(start),
        new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: tz }).format(start),
        fmtTime.format(start),
        fmtTime.format(end),
        String(s.available_count),
        s.available_emails.join("; "),
      ];
    });
    downloadCsv([header, ...rows], `bookable-slots-${fmtIsoDate.format(new Date()).replace(/-/g, "")}.csv`);
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-auto h-[80vh] w-full max-w-3xl rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-foreground/40 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-accent">
            {rangeLabel}
          </span>
          <h3 className="font-heading text-xl font-semibold leading-snug">
            {slots.length} bookable slot{slots.length === 1 ? "" : "s"}
          </h3>
          <p className="text-xs text-muted-foreground">
            Each row is a time slot where at least one closer is free. Times in {tz}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-md border border-border bg-secondary/40 px-3 py-1.5 text-xs font-medium hover:bg-secondary"
          >
            Download CSV
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Close"
          >
            <span aria-hidden className="text-lg leading-none">×</span>
          </button>
        </div>
      </div>

      <div className="overflow-auto" style={{ height: "calc(80vh - 140px)" }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-secondary/40 backdrop-blur">
            <tr>
              <Th>Date</Th>
              <Th>Time</Th>
              <Th>Free</Th>
              <Th>Available closers</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {slots.map((s, i) => {
              const start = new Date(s.slot_start);
              const end = new Date(s.slot_end);
              return (
                <tr key={`${s.slot_start}-${i}`} className="hover:bg-secondary/30">
                  <Td>
                    <div className="font-medium">{fmtDate.format(start)}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {fmtIsoDate.format(start)}
                    </div>
                  </Td>
                  <Td>
                    <span className="font-mono tabular-nums">
                      {fmtTime.format(start)} – {fmtTime.format(end)}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-sm font-semibold tabular-nums">
                      {s.available_count}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {s.available_emails.map((e) => (
                        <span
                          key={e}
                          className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-xs font-medium"
                        >
                          {shortName(e)}
                        </span>
                      ))}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </dialog>
  );
}

function ClosersDialog({
  open,
  onClose,
  members,
  fromDate,
  toDate,
  slots,
  tz,
}: {
  open: boolean;
  onClose: () => void;
  members: string[];
  fromDate: string;
  toDate: string;
  slots: RangeSlot[];
  tz: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open) {
      if (!dlg.open) dlg.showModal();
    } else {
      if (dlg.open) dlg.close();
    }
  }, [open]);

  // Compute per-closer free-slot counts in this range
  const free: Record<string, number> = {};
  for (const m of members) free[m] = 0;
  for (const s of slots) {
    for (const e of s.available_emails) {
      if (e in free) free[e] += 1;
    }
  }

  const exportCsv = () => {
    const header = ["email", "short_name", "free_slots", "total_slots", "free_pct"];
    const total = slots.length;
    const rows = members.map((email) => {
      const f = free[email] ?? 0;
      const pct = total > 0 ? Math.round((f / total) * 100) : 0;
      return [email, shortName(email), String(f), String(total), `${pct}%`];
    });
    downloadCsv([header, ...rows], `active-closers-${fromDate}_to_${toDate}.csv`);
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-auto w-full max-w-2xl rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-foreground/40 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-accent">
            in pool
          </span>
          <h3 className="font-heading text-xl font-semibold leading-snug">
            {members.length} active &amp; available closer{members.length === 1 ? "" : "s"}
          </h3>
          <p className="text-xs text-muted-foreground">
            All have shared their calendar with ops@ and are flagged active &amp; available.
            Free-slot counts are within {fromDate} → {toDate}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-md border border-border bg-secondary/40 px-3 py-1.5 text-xs font-medium hover:bg-secondary"
          >
            Download CSV
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Close"
          >
            <span aria-hidden className="text-lg leading-none">×</span>
          </button>
        </div>
      </div>

      <div className="overflow-auto px-6 py-5">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40">
            <tr>
              <Th>Closer</Th>
              <Th>Email</Th>
              <Th>Free slots</Th>
              <Th>Quick link</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[...members]
              .sort((a, b) => (free[b] ?? 0) - (free[a] ?? 0))
              .map((email) => (
                <tr key={email} className="hover:bg-secondary/30">
                  <Td>
                    <span className="font-medium">{shortName(email)}</span>
                  </Td>
                  <Td>
                    <span className="font-mono text-xs text-muted-foreground">{email}</span>
                  </Td>
                  <Td>
                    <span className="font-mono text-sm font-semibold tabular-nums">
                      {free[email] ?? 0}
                    </span>
                    <span className="ml-1 text-xs text-muted-foreground">
                      / {slots.length}
                    </span>
                  </Td>
                  <Td>
                    <Link
                      href={`/apps/calendar/team/${encodeURIComponent(email)}?date=${fromDate}&tz=${encodeURIComponent(tz)}`}
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      view week →
                    </Link>
                  </Td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </dialog>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}
