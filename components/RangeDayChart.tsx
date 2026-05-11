"use client";

import { useEffect, useRef, useState } from "react";
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

type DayBucket = {
  slot_date: string;
  available_capacity: number;
  max_capacity: number;
  bookable_slots: number;
  total_slots: number;
};

export function RangeDayChart({
  buckets,
  slots,
  members,
  tz,
}: {
  buckets: DayBucket[];
  slots: RangeSlot[];
  members: string[];
  tz: string;
}) {
  const [openDate, setOpenDate] = useState<string | null>(null);

  const fmtDay = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: tz,
  });

  const data = buckets.map((b) => ({
    label: fmtDay.format(new Date(b.slot_date + "T12:00:00Z")),
    slot_date: b.slot_date,
    capacity: b.available_capacity,
    total_slots: b.total_slots,
  }));

  const handleBarClick = (data: unknown) => {
    if (!data || typeof data !== "object") return;
    const d = data as { slot_date?: string; payload?: { slot_date?: string } };
    const date = d.slot_date ?? d.payload?.slot_date;
    if (date) setOpenDate(date);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Slots available per day
      </p>
      <h3 className="mt-1 font-heading text-lg font-semibold">
        Where is the headroom?
      </h3>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Click a bar to see which closer is free how often that day.
      </p>

      <div className="mt-4 h-56 w-full cursor-pointer">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={56}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              width={36}
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
              formatter={(v) => [
                `${Number(v)} call${Number(v) === 1 ? "" : "s"} bookable — click for details`,
                "",
              ]}
            />
            <Bar
              dataKey="capacity"
              fill="var(--nmm-green)"
              radius={[6, 6, 0, 0]}
              style={{ cursor: "pointer" }}
              onClick={handleBarClick}
            >
              <LabelList
                dataKey="capacity"
                position="top"
                style={{ fill: "var(--foreground)", fontSize: 12, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <DayClosersDialog
        date={openDate}
        slots={slots}
        members={members}
        tz={tz}
        onClose={() => setOpenDate(null)}
      />
    </div>
  );
}

// =============================================================
// Per-day closers breakdown dialog
// =============================================================

function DayClosersDialog({
  date,
  slots,
  members,
  tz,
  onClose,
}: {
  date: string | null;
  slots: RangeSlot[];
  members: string[];
  tz: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (date) {
      if (!dlg.open) dlg.showModal();
    } else {
      if (dlg.open) dlg.close();
    }
  }, [date]);

  if (!date) return null;

  const fmtDayLong = new Intl.DateTimeFormat("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: tz,
  });

  const dayslots = slots.filter((s) => s.slot_date === date);
  const totalDaySlots = dayslots.length;

  const freeCount: Record<string, number> = {};
  for (const m of members) freeCount[m] = 0;
  for (const s of dayslots) {
    for (const e of s.available_emails) {
      if (e in freeCount) freeCount[e] += 1;
    }
  }

  const sorted = members
    .map((email) => ({ email, free: freeCount[email] ?? 0 }))
    .sort((a, b) => b.free - a.free);

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
            {totalDaySlots} slots that day
          </span>
          <h3 className="font-heading text-xl font-semibold leading-snug">
            {fmtDayLong.format(new Date(date + "T12:00:00Z"))}
          </h3>
          <p className="text-xs text-muted-foreground">
            How many slots is each closer free for, only on this day.
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
        <ul className="space-y-1.5">
          {sorted.map((row) => (
            <li
              key={row.email}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm"
            >
              <span className="font-medium">{shortName(row.email)}</span>
              <span className="font-mono text-sm font-semibold tabular-nums">
                {row.free}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  / {totalDaySlots}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  );
}
