"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { RangeSlot } from "@/lib/availability";

const shortName = (email: string) => email.split("@")[0];

export function RangePerCloserChart({
  slots,
  members,
  totalSlots,
  fromDate,
  toDate,
  daysCount,
  tz,
  selectedTeam,
}: {
  slots: RangeSlot[];
  members: string[];
  totalSlots: number;
  fromDate: string;
  toDate: string;
  daysCount: number;
  tz: string;
  selectedTeam: string[];
}) {
  const [openEmail, setOpenEmail] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  // Raw availability per closer (each can be free in same slot independently).
  const freeCount: Record<string, number> = {};
  for (const m of members) freeCount[m] = 0;
  for (const s of slots) {
    for (const e of s.available_emails) {
      if (e in freeCount) freeCount[e] += 1;
    }
  }

  const data = members
    .map((email) => ({
      email,
      name: shortName(email),
      free_slots: freeCount[email] ?? 0,
    }))
    .sort((a, b) => a.free_slots - b.free_slots);

  const handleBarClick = (data: unknown) => {
    if (!data || typeof data !== "object") return;
    const d = data as { email?: string; payload?: { email?: string } };
    const email = d.email ?? d.payload?.email;
    if (email) setOpenEmail(email);
  };

  const toggleFilter = (email: string) => {
    const next = new URLSearchParams(searchParams);
    const isOnlyThis = selectedTeam.length === 1 && selectedTeam[0] === email;
    if (isOnlyThis) next.delete("team");
    else next.set("team", email);
    startTransition(() => router.push(`/apps/calendar?${next.toString()}`, { scroll: false }));
  };

  const clearFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("team");
    startTransition(() => router.push(`/apps/calendar?${next.toString()}`, { scroll: false }));
  };

  return (
    <div
      data-pending={pending ? "" : undefined}
      className="rounded-xl border border-border bg-card p-5 data-[pending]:opacity-70 data-[pending]:transition-opacity"
    >
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Slots each closer is free for
          </p>
          <h3 className="mt-1 font-heading text-lg font-semibold">
            Who is available the most?
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Click a bar for the day-by-day breakdown.
          </p>
        </div>
        {selectedTeam.length > 0 ? (
          <button
            type="button"
            onClick={clearFilter}
            className="shrink-0 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium text-muted-foreground hover:border-foreground/40 hover:text-foreground"
          >
            clear filter
          </button>
        ) : null}
      </div>

      <div className="mt-4 h-64 w-full cursor-pointer">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval={0}
              angle={-25}
              textAnchor="end"
              height={56}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              width={28}
            />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--foreground)",
              }}
              labelStyle={{ color: "var(--muted-foreground)", marginBottom: 4 }}
              formatter={(v, key, item) => {
                const p = item.payload as { name: string; free_slots: number };
                return [
                  `${p.name} is free for ${p.free_slots} slot${p.free_slots === 1 ? "" : "s"} — click for details`,
                  "",
                ];
              }}
            />
            <Bar
              dataKey="free_slots"
              fill="var(--nmm-green)"
              radius={[6, 6, 0, 0]}
              style={{ cursor: "pointer" }}
              onClick={handleBarClick}
            >
              <LabelList
                dataKey="free_slots"
                position="top"
                style={{ fill: "var(--foreground)", fontSize: 12, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Filter slot matrix by closer (click a name)
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {data.map((p) => {
            const isActive = selectedTeam.length === 1 && selectedTeam[0] === p.email;
            return (
              <li key={p.email}>
                <button
                  type="button"
                  onClick={() => toggleFilter(p.email)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-foreground hover:border-foreground/40"
                  }`}
                >
                  <span>{p.name}</span>
                  <span
                    className={`font-mono text-[10px] tabular-nums ${
                      isActive ? "opacity-70" : "text-muted-foreground"
                    }`}
                  >
                    {p.free_slots}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <CloserDayBreakdownDialog
        email={openEmail}
        slots={slots}
        members={members}
        totalSlots={totalSlots}
        fromDate={fromDate}
        toDate={toDate}
        daysCount={daysCount}
        tz={tz}
        onClose={() => setOpenEmail(null)}
      />
    </div>
  );
}

// =============================================================
// Per-closer day breakdown dialog
// =============================================================

function CloserDayBreakdownDialog({
  email,
  slots,
  totalSlots,
  fromDate,
  toDate,
  daysCount,
  tz,
  onClose,
}: {
  email: string | null;
  slots: RangeSlot[];
  members: string[];
  totalSlots: number;
  fromDate: string;
  toDate: string;
  daysCount: number;
  tz: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (email) {
      if (!dlg.open) dlg.showModal();
    } else {
      if (dlg.open) dlg.close();
    }
  }, [email]);

  if (!email) return null;

  // Per-day count of slots where this closer is free
  const fmtDate = new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: tz,
  });
  const fmtTime = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz,
  });

  const byDay = new Map<string, RangeSlot[]>();
  for (const s of slots) {
    if (!s.available_emails.includes(email)) continue;
    const arr = byDay.get(s.slot_date) ?? [];
    arr.push(s);
    byDay.set(s.slot_date, arr);
  }
  const days = Array.from(byDay.keys()).sort();
  const total = Array.from(byDay.values()).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-auto h-[80vh] w-full max-w-2xl rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-foreground/40 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-accent">
            {fromDate} → {toDate}
          </span>
          <h3 className="font-heading text-xl font-semibold leading-snug">
            {shortName(email)}&apos;s availability
          </h3>
          <p className="text-xs text-muted-foreground">
            Free for <span className="font-semibold text-foreground">{total}</span> of {totalSlots} slots ({tz})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/apps/calendar/team/${encodeURIComponent(email)}?date=${fromDate}&days=${daysCount}&tz=${encodeURIComponent(tz)}`}
            className="rounded-md border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20"
          >
            View full calendar →
          </Link>
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
        {days.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            No free slots in this range.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {days.map((d) => {
              const arr = byDay.get(d) ?? [];
              return (
                <li key={d} className="px-6 py-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h4 className="font-heading text-base font-semibold">
                      {fmtDate.format(new Date(d + "T12:00:00Z"))}
                    </h4>
                    <span className="rounded-full bg-secondary/40 px-2.5 py-0.5 text-xs font-medium tabular-nums">
                      {arr.length} slot{arr.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {arr.map((s) => (
                      <li
                        key={s.slot_start}
                        className="rounded-md border border-border bg-secondary/20 px-2 py-1 font-mono text-xs tabular-nums"
                      >
                        {fmtTime.format(new Date(s.slot_start))} – {fmtTime.format(new Date(s.slot_end))}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </dialog>
  );
}
