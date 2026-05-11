"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { BusyInterval } from "@/lib/availability";

export type PersonStat = { email: string; busy_min: number; events: number };

const shortName = (email: string) => email.split("@")[0];

export function PerPersonChart({
  data,
  date,
  tz,
  forDate,
  eventsByEmail,
  selectedTeam,
}: {
  data: PersonStat[];
  date: string;
  tz: string;
  forDate: string;
  eventsByEmail: Record<string, BusyInterval[]>;
  selectedTeam: string[];
}) {
  const sorted = [...data].sort((a, b) => b.busy_min - a.busy_min);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const toggleTeamFilter = (email: string) => {
    const next = new URLSearchParams(searchParams);
    const set = new Set(selectedTeam);
    if (set.has(email)) set.delete(email);
    else set.add(email);
    if (set.size === 0) next.delete("team");
    else next.set("team", Array.from(set).join(","));
    startTransition(() => router.push(`/apps/calendar?${next.toString()}`, { scroll: false }));
  };

  const clearTeamFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("team");
    startTransition(() => router.push(`/apps/calendar?${next.toString()}`, { scroll: false }));
  };

  const chartData = sorted.map((p) => ({
    ...p,
    name: shortName(p.email),
  }));

  const handleClick = (e: unknown) => {
    if (!e || typeof e !== "object") return;
    const evt = e as { activePayload?: Array<{ payload?: { email?: string } }> };
    const email = evt.activePayload?.[0]?.payload?.email;
    if (email) setSelectedEmail(email);
  };

  return (
    <div
      data-pending={pending ? "" : undefined}
      className="rounded-xl border border-border bg-card p-5 data-[pending]:opacity-70 data-[pending]:transition-opacity"
    >
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Workload on {forDate}
          </p>
          <h3 className="mt-1 font-heading text-lg font-semibold">
            How busy is each teammate?
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            click a bar to see the day&apos;s events &middot; click a name below to filter the slot grid
          </p>
        </div>
        {selectedTeam.length > 0 ? (
          <button
            type="button"
            onClick={clearTeamFilter}
            className="shrink-0 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium text-muted-foreground hover:border-foreground/40 hover:text-foreground"
          >
            clear filter ({selectedTeam.length})
          </button>
        ) : null}
      </div>

      <div className="h-64 w-full cursor-pointer">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 16, left: 0, bottom: 4 }}
            onClick={handleClick}
          >
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
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              width={36}
              tickFormatter={(v: number) => `${Math.round(v / 60)}h`}
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
              formatter={(v, key) => {
                if (key === "busy_min") {
                  const num = Number(v);
                  const h = Math.floor(num / 60);
                  const m = num % 60;
                  return [`${h}h ${m}m · click for details`, "Busy time"];
                }
                return [String(v), String(key)];
              }}
            />
            <Bar
              dataKey="busy_min"
              fill="var(--nmm-blue)"
              radius={[6, 6, 0, 0]}
              onClick={(payload: unknown) => {
                if (!payload || typeof payload !== "object") return;
                const email = (payload as { email?: string }).email;
                if (email) setSelectedEmail(email);
              }}
              style={{ cursor: "pointer" }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Filter slot grid by teammate
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {sorted.map((p) => {
            const isActive = selectedTeam.includes(p.email);
            return (
              <li key={p.email}>
                <button
                  type="button"
                  onClick={() => toggleTeamFilter(p.email)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-foreground hover:border-foreground/40"
                  }`}
                >
                  <span>{shortName(p.email)}</span>
                  <span
                    className={`font-mono text-[10px] tabular-nums ${
                      isActive ? "opacity-70" : "text-muted-foreground"
                    }`}
                  >
                    {Math.round(p.busy_min / 60)}h
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <PersonDayDialog
        email={selectedEmail}
        intervals={selectedEmail ? eventsByEmail[selectedEmail] ?? [] : []}
        forDate={forDate}
        date={date}
        tz={tz}
        onClose={() => setSelectedEmail(null)}
      />
    </div>
  );
}

function PersonDayDialog({
  email,
  intervals,
  forDate,
  date,
  tz,
  onClose,
}: {
  email: string | null;
  intervals: BusyInterval[];
  forDate: string;
  date: string;
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

  const fmtTime = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  });

  const sorted = [...intervals].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--nmm-blue)]/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--nmm-blue)]">
            {forDate}
          </span>
          <h3 className="font-heading text-xl font-semibold leading-snug">
            {shortName(email)}&apos;s day
          </h3>
          <p className="text-xs text-muted-foreground">
            {email} &middot; {sorted.length} event{sorted.length === 1 ? "" : "s"} &middot; {tz}
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

      <div className="max-h-[60vh] overflow-y-auto">
        {sorted.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            No events on this day.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {sorted.map((ev, i) => {
              const s = new Date(ev.start_time);
              const e = new Date(ev.end_time);
              const sourceTone = ev.is_calendly_booking
                ? "bg-[var(--nmm-warm)]/15 text-[var(--nmm-warm)]"
                : ev.is_all_day
                ? "bg-muted text-muted-foreground"
                : "bg-[var(--nmm-blue)]/15 text-[var(--nmm-blue)]";
              const sourceLabel = ev.is_calendly_booking
                ? "Calendly"
                : ev.is_all_day
                ? "All-day"
                : "Internal";
              return (
                <li
                  key={`${ev.start_time}-${i}`}
                  className="grid grid-cols-[80px_1fr_auto] items-start gap-3 px-6 py-4"
                >
                  <div className="font-mono text-xs tabular-nums text-muted-foreground">
                    {ev.is_all_day ? (
                      <span>all day</span>
                    ) : (
                      <>
                        <div>{fmtTime.format(s)}</div>
                        <div className="text-[10px]">– {fmtTime.format(e)}</div>
                      </>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium leading-tight">{ev.title}</div>
                    {ev.calendly_invitee_name ? (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        with {ev.calendly_invitee_name}
                        {ev.calendly_invitee_email ? (
                          <span className="ml-1">&middot; {ev.calendly_invitee_email}</span>
                        ) : null}
                      </div>
                    ) : null}
                    {ev.calendly_event_type && ev.calendly_event_type !== ev.title ? (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {ev.calendly_event_type}
                      </div>
                    ) : null}
                    {!ev.is_calendly_booking && ev.attendee_count ? (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {ev.attendee_count} attendee{ev.attendee_count === 1 ? "" : "s"}
                      </div>
                    ) : null}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${sourceTone}`}
                  >
                    {sourceLabel}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
        <Link
          href={`/apps/calendar/team/${encodeURIComponent(email)}?date=${date}&tz=${encodeURIComponent(tz)}`}
          className="text-xs font-medium uppercase tracking-[0.14em] text-accent hover:underline"
        >
          Open full week →
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
        >
          Close
        </button>
      </div>
    </dialog>
  );
}
