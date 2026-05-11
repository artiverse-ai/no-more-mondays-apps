"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Slot } from "@/lib/availability";

type Point = {
  time: string;
  minutesOfDay: number;
  available: number;
  busy: number;
  emails: string[];
  slotStart: string;
};

const shortName = (email: string) => email.split("@")[0];

export function AvailabilityChart({
  slots,
  totalMembers,
  tz,
  forDate,
  date,
}: {
  slots: Slot[];
  totalMembers: number;
  tz: string;
  forDate: string;
  date: string;
}) {
  const [selected, setSelected] = useState<Point | null>(null);

  const fmt = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  });

  const data: Point[] = slots.map((s) => {
    const d = new Date(s.slot_start);
    const time = fmt.format(d);
    const [h, m] = time.split(":").map((n) => parseInt(n, 10));
    return {
      time,
      minutesOfDay: h * 60 + m,
      available: s.available_count,
      busy: totalMembers - s.available_count,
      emails: s.available_emails,
      slotStart: s.slot_start,
    };
  });

  if (data.length === 0) return null;

  const handleChartClick = (e: unknown) => {
    if (!e || typeof e !== "object") return;
    const evt = e as { activePayload?: Array<{ payload?: Point }> };
    const payload = evt.activePayload?.[0]?.payload;
    if (payload && typeof payload.time === "string") setSelected(payload);
  };

  // activeDot rendered as a clickable SVG circle — Recharts' chart onClick is
  // unreliable when clicking right on a data point, so we wire the click here.
  const renderActiveDot = (props: unknown) => {
    if (!props || typeof props !== "object") return <></>;
    const p = props as {
      cx?: number;
      cy?: number;
      payload?: Point;
    };
    if (typeof p.cx !== "number" || typeof p.cy !== "number" || !p.payload) {
      return <></>;
    }
    const payload = p.payload;
    return (
      <g style={{ cursor: "pointer" }} onClick={() => setSelected(payload)}>
        <circle
          cx={p.cx}
          cy={p.cy}
          r={12}
          fill="var(--nmm-green)"
          fillOpacity={0.0}
        />
        <circle cx={p.cx} cy={p.cy} r={5} fill="var(--nmm-green)" />
      </g>
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Availability across {forDate}
          </p>
          <h3 className="mt-1 font-heading text-lg font-semibold">
            How many teammates are free at each time?
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            click any point to see who&apos;s free at that time
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Legend swatch="bg-accent" label="available" />
          <Legend swatch="bg-destructive/40" label="busy" />
        </div>
      </div>

      <div className="h-72 w-full cursor-pointer">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 16, left: 0, bottom: 4 }}
            onClick={handleChartClick}
          >
            <defs>
              <linearGradient id="availGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--nmm-green)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--nmm-green)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval={7}
            />
            <YAxis
              domain={[0, totalMembers]}
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
              formatter={(v, name) => [
                `${Number(v)}/${totalMembers}`,
                name === "available" ? "Free" : "Busy",
              ]}
              labelFormatter={(l) => `Slot ${l} · click for details`}
            />
            <ReferenceLine
              y={totalMembers}
              stroke="var(--border)"
              strokeDasharray="4 4"
              label={{
                value: `team size: ${totalMembers}`,
                position: "insideTopRight",
                fill: "var(--muted-foreground)",
                fontSize: 10,
              }}
            />
            <Area
              type="monotone"
              dataKey="available"
              stroke="var(--nmm-green)"
              strokeWidth={2}
              fill="url(#availGrad)"
              dot={false}
              activeDot={renderActiveDot}
              onClick={(payload: unknown) => {
                if (!payload || typeof payload !== "object") return;
                const p = (payload as { payload?: Point }).payload;
                if (p) setSelected(p);
              }}
              style={{ cursor: "pointer" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <SlotDetailDialog
        point={selected}
        onClose={() => setSelected(null)}
        forDate={forDate}
        date={date}
        tz={tz}
        totalMembers={totalMembers}
      />
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${swatch}`} />
      {label}
    </span>
  );
}

function SlotDetailDialog({
  point,
  onClose,
  forDate,
  date,
  tz,
  totalMembers,
}: {
  point: Point | null;
  onClose: () => void;
  forDate: string;
  date: string;
  tz: string;
  totalMembers: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (point) {
      if (!dlg.open) dlg.showModal();
    } else {
      if (dlg.open) dlg.close();
    }
  }, [point]);

  if (!point) return null;

  const busyCount = totalMembers - point.available;

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
            Slot {point.time}
          </span>
          <h3 className="font-heading text-xl font-semibold leading-snug">
            {point.available} of {totalMembers} teammates free
          </h3>
          <p className="text-xs text-muted-foreground">
            {forDate} &middot; {tz}
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
        {point.emails.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one is free in this slot.</p>
        ) : (
          <>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Available teammates &middot; click a name to open their week
            </p>
            <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {point.emails.map((email) => (
                <li key={email}>
                  <Link
                    href={`/apps/calendar/team/${encodeURIComponent(email)}?date=${date}&tz=${encodeURIComponent(tz)}`}
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
            {busyCount} teammate{busyCount === 1 ? "" : "s"} {busyCount === 1 ? "is" : "are"} booked
            in this slot.
          </p>
        ) : null}
      </div>
    </dialog>
  );
}
