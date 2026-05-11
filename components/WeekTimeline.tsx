"use client";

import { useEffect, useRef, useState } from "react";
import type { BusyInterval } from "@/lib/availability";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
// Bigger HOUR_HEIGHT = more room for events. Page will scroll if needed.
const HOUR_HEIGHT = 56;
const MINUTE_PX = HOUR_HEIGHT / 60;
const DAY_COL_MIN_WIDTH = 150;
const HOUR_COL_WIDTH = 56;

function dateKeyInTz(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function startOfDayInTz(dateKey: string, tz: string): Date {
  const parts = dateKey.split("-").map((s) => parseInt(s, 10));
  const utcMid = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "shortOffset",
  });
  const offsetPart = dtf.formatToParts(utcMid).find((p) => p.type === "timeZoneName");
  const m = offsetPart?.value.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  let offsetMin = 0;
  if (m) {
    const sign = m[1] === "+" ? 1 : -1;
    const h = parseInt(m[2], 10);
    const mm = m[3] ? parseInt(m[3], 10) : 0;
    offsetMin = sign * (h * 60 + mm);
  }
  return new Date(utcMid.getTime() - offsetMin * 60_000);
}

type DayBuckets = {
  allDay: BusyInterval[];
  timed: BusyInterval[];
};

type LaidOutEvent = BusyInterval & {
  layout: { column: number; columnsCount: number };
};

/**
 * Google-Calendar-style overlap layout: cluster events that overlap, then
 * greedily assign each to the leftmost column that's free. Width = 100% /
 * max-columns-active-in-the-cluster.
 */
function layoutOverlaps(events: BusyInterval[]): LaidOutEvent[] {
  if (events.length === 0) return [];
  const sorted = events
    .map((ev) => ({
      ev,
      startMs: new Date(ev.start_time).getTime(),
      endMs: new Date(ev.end_time).getTime(),
    }))
    .sort((a, b) => a.startMs - b.startMs || b.endMs - a.endMs);

  const out: LaidOutEvent[] = [];

  type Item = { ev: BusyInterval; startMs: number; endMs: number };
  let cluster: Item[] = [];
  let clusterEnd = -Infinity;

  const flush = (c: Item[]) => {
    if (c.length === 0) return;
    const columns: number[] = []; // each entry = endMs of the latest event in that column
    const placements: { item: Item; column: number }[] = [];
    for (const it of c) {
      let placed = -1;
      for (let i = 0; i < columns.length; i++) {
        if (columns[i] <= it.startMs) {
          columns[i] = it.endMs;
          placed = i;
          break;
        }
      }
      if (placed === -1) {
        columns.push(it.endMs);
        placed = columns.length - 1;
      }
      placements.push({ item: it, column: placed });
    }
    const columnsCount = columns.length;
    for (const p of placements) {
      out.push({ ...p.item.ev, layout: { column: p.column, columnsCount } });
    }
  };

  for (const it of sorted) {
    if (cluster.length === 0 || it.startMs >= clusterEnd) {
      flush(cluster);
      cluster = [it];
      clusterEnd = it.endMs;
    } else {
      cluster.push(it);
      clusterEnd = Math.max(clusterEnd, it.endMs);
    }
  }
  flush(cluster);

  return out;
}

export function WeekTimeline({
  intervals,
  dateFrom,
  daysCount,
  tz,
}: {
  intervals: BusyInterval[];
  dateFrom: string;
  daysCount: number;
  tz: string;
}) {
  const [selected, setSelected] = useState<BusyInterval | null>(null);

  const days: { key: string; weekday: string; rest: string; isWeekend: boolean }[] = [];
  const startMid = startOfDayInTz(dateFrom, tz);
  for (let i = 0; i < daysCount; i++) {
    const d = new Date(startMid.getTime() + i * 86_400_000);
    const key = dateKeyInTz(d, tz);
    const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: tz }).format(d);
    const rest = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: tz,
    }).format(d);
    days.push({
      key,
      weekday,
      rest,
      isWeekend: weekday === "Sat" || weekday === "Sun",
    });
  }

  const buckets = new Map<string, DayBuckets>();
  for (const d of days) buckets.set(d.key, { allDay: [], timed: [] });

  for (const ev of intervals) {
    const evStart = new Date(ev.start_time);
    const evEnd = new Date(ev.end_time);
    for (const d of days) {
      const dayStart = startOfDayInTz(d.key, tz);
      const dayEnd = new Date(dayStart.getTime() + 86_400_000);
      if (evEnd > dayStart && evStart < dayEnd) {
        const arr = buckets.get(d.key);
        if (!arr) continue;
        if (ev.is_all_day) {
          if (!arr.allDay.find((a) => a.start_time === ev.start_time && a.title === ev.title)) {
            arr.allDay.push(ev);
          }
        } else {
          arr.timed.push(ev);
        }
      }
    }
  }

  const timeFmt = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  });

  const gridCols = `${HOUR_COL_WIDTH}px repeat(${daysCount}, minmax(${DAY_COL_MIN_WIDTH}px, 1fr))`;

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="relative max-h-[80vh] overflow-auto">
          {/* Day headers — sticky top */}
          <div
            className="sticky top-0 z-30 grid border-b border-border bg-card/95 backdrop-blur"
            style={{ gridTemplateColumns: gridCols }}
          >
            <div className="sticky left-0 z-30 border-r border-border bg-card/95 px-2 py-3 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
              hour
            </div>
            {days.map((d) => (
              <div
                key={`h-${d.key}`}
                className={`flex flex-col items-center justify-center border-l border-border px-3 py-3 text-center ${
                  d.isWeekend ? "bg-secondary/15" : ""
                }`}
              >
                <span className="font-heading text-sm font-semibold tracking-tight">
                  {d.weekday} {d.rest.split(" ")[1]}
                </span>
                <span className="mt-0.5 text-[10px] text-muted-foreground">
                  {d.rest.split(" ")[0]}
                </span>
              </div>
            ))}
          </div>

          {/* All-day band — sticky right below day headers */}
          <div
            className="sticky top-[58px] z-20 grid border-b border-border bg-secondary/15"
            style={{ gridTemplateColumns: gridCols }}
          >
            <div className="sticky left-0 z-20 border-r border-border bg-secondary/40 px-2 py-1 text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground backdrop-blur">
              all day
            </div>
            {days.map((d) => {
              const b = buckets.get(d.key) ?? { allDay: [], timed: [] };
              return (
                <div
                  key={`ad-${d.key}`}
                  className={`flex min-h-[40px] flex-col gap-0.5 border-l border-border p-1.5 ${
                    d.isWeekend ? "bg-secondary/10" : ""
                  }`}
                >
                  {b.allDay.map((ev, i) => (
                    <button
                      key={`ad-${i}`}
                      type="button"
                      onClick={() => setSelected(ev)}
                      title={ev.title}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--nmm-stone)] bg-[var(--nmm-stone)]/40 px-2 py-1 text-left text-[11px] font-medium text-foreground transition-colors hover:bg-[var(--nmm-stone)]/70"
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                      <span className="truncate">{ev.title || "All-day"}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Timeline body */}
          <div className="grid" style={{ gridTemplateColumns: gridCols }}>
            {/* Hour labels (sticky left) — fixed pixel positions */}
            <div
              className="relative sticky left-0 z-10 border-r border-border bg-card/95 backdrop-blur"
              style={{ height: `${24 * HOUR_HEIGHT}px` }}
            >
              {HOURS.map((h) => (
                <span
                  key={h}
                  className="absolute right-2 font-mono text-[10px] font-medium tabular-nums text-muted-foreground"
                  style={{
                    top: h === 0 ? 2 : `${h * HOUR_HEIGHT}px`,
                    transform: h === 0 ? "none" : "translateY(-50%)",
                  }}
                >
                  {`${String(h).padStart(2, "0")}:00`}
                </span>
              ))}
            </div>

            {/* Day columns */}
            {days.map((d) => {
              const b = buckets.get(d.key) ?? { allDay: [], timed: [] };
              const dayStart = startOfDayInTz(d.key, tz);
              const dayEnd = new Date(dayStart.getTime() + 86_400_000);

              return (
                <div
                  key={`col-${d.key}`}
                  className={`relative border-l border-border ${
                    d.isWeekend ? "bg-secondary/10" : ""
                  }`}
                  style={{ height: `${24 * HOUR_HEIGHT}px` }}
                >
                  {/* Hour gridlines — every hour, fixed pixel positions */}
                  {HOURS.map((h) => (
                    <div
                      key={`gl-${h}`}
                      className="pointer-events-none absolute inset-x-0 border-t border-border/45"
                      style={{ top: `${h * HOUR_HEIGHT}px` }}
                    />
                  ))}

                  {/* Timed events — laid out side-by-side when overlapping */}
                  {layoutOverlaps(b.timed).map((ev, idx) => {
                    const s = new Date(ev.start_time);
                    const e = new Date(ev.end_time);
                    const startClipped = Math.max(s.getTime(), dayStart.getTime());
                    const endClipped = Math.min(e.getTime(), dayEnd.getTime());
                    const startMin = (startClipped - dayStart.getTime()) / 60_000;
                    const durMin = (endClipped - startClipped) / 60_000;
                    const topPx = startMin * MINUTE_PX;
                    const heightPx = Math.max(20, durMin * MINUTE_PX);
                    const widthPct = 100 / ev.layout.columnsCount;
                    const leftPct = ev.layout.column * widthPct;
                    const cls = ev.is_calendly_booking
                      ? "bg-[var(--nmm-warm-soft)] text-[var(--nmm-warm-ink)] border-[var(--nmm-warm)]"
                      : "bg-[var(--nmm-blue-soft)] text-[var(--nmm-blue-ink)] border-[var(--nmm-blue)]";
                    const tooltip = `${timeFmt.format(s)}–${timeFmt.format(e)}  ·  ${ev.title}${
                      ev.calendly_invitee_name ? `  ·  with ${ev.calendly_invitee_name}` : ""
                    }`;
                    return (
                      <button
                        key={`t-${ev.start_time}-${idx}`}
                        type="button"
                        onClick={() => setSelected(ev)}
                        title={tooltip}
                        className={`absolute cursor-pointer overflow-hidden rounded-sm border-l-[3px] text-left transition-all hover:z-20 hover:brightness-95 ${cls}`}
                        style={{
                          top: `${topPx}px`,
                          height: `${heightPx}px`,
                          left: `calc(${leftPct}% + 1px)`,
                          width: `calc(${widthPct}% - 2px)`,
                        }}
                      >
                        <div className="px-1.5 py-0.5 text-[10px] font-medium leading-tight">
                          <div className="truncate">{ev.title}</div>
                          {durMin >= 50 ? (
                            <div className="mt-0.5 truncate text-[9px] font-normal opacity-75">
                              {timeFmt.format(s)}–{timeFmt.format(e)}
                            </div>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}

                  {b.allDay.length === 0 && b.timed.length === 0 ? (
                    <span className="absolute left-3 top-3 text-[10px] uppercase tracking-wider text-muted-foreground/60">
                      free
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5 border-t border-border bg-secondary/15 px-5 py-3 text-xs text-muted-foreground">
          <Legend tone="bg-[var(--nmm-blue)]" label="Meeting" />
          <Legend tone="bg-[var(--nmm-warm)]" label="Calendly call" />
          <Legend tone="bg-[var(--nmm-stone)]/60 border border-[var(--nmm-stone)]" label="Out of office" />
          <span className="ml-auto hidden text-[11px] sm:inline">
            Click any block for details
          </span>
        </div>
      </div>

      <EventDetailDialog
        event={selected}
        onClose={() => setSelected(null)}
        tz={tz}
      />
    </>
  );
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`inline-block h-3 w-4 rounded-sm ${tone}`} />
      {label}
    </span>
  );
}

// ---------- Detail dialog ----------

function EventDetailDialog({
  event,
  onClose,
  tz,
}: {
  event: BusyInterval | null;
  onClose: () => void;
  tz: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (event) {
      if (!dlg.open) dlg.showModal();
    } else {
      if (dlg.open) dlg.close();
    }
  }, [event]);

  if (!event) return null;

  const s = new Date(event.start_time);
  const e = new Date(event.end_time);
  const fmtDayLong = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: tz,
  });
  const fmtTime = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  });

  let qa: { question: string; answer: string }[] | null = null;
  if (event.calendly_qa) {
    try {
      qa = JSON.parse(event.calendly_qa) as { question: string; answer: string }[];
    } catch {
      qa = null;
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-auto w-full max-w-lg rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-foreground/40 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
        <div className="space-y-1">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${
              event.is_calendly_booking
                ? "bg-[var(--nmm-warm)]/15 text-[var(--nmm-warm)]"
                : event.is_all_day
                ? "bg-muted text-muted-foreground"
                : "bg-[var(--nmm-blue)]/15 text-[var(--nmm-blue)]"
            }`}
          >
            {event.is_calendly_booking
              ? "Calendly booking"
              : event.is_all_day
              ? "All-day"
              : "Internal meeting"}
          </span>
          <h3 className="font-heading text-xl font-semibold leading-snug">
            {event.title}
          </h3>
          <p className="text-xs text-muted-foreground">{fmtDayLong.format(s)}</p>
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

      <div className="space-y-5 px-6 py-5 text-sm">
        <DetailRow label="Time">
          <span className="font-mono tabular-nums">
            {event.is_all_day ? "All day" : `${fmtTime.format(s)} – ${fmtTime.format(e)}`}
          </span>
          <span className="ml-2 text-xs text-muted-foreground">
            {event.duration_min}m &middot; {tz}
          </span>
        </DetailRow>

        <DetailRow label="Host">{event.host_email}</DetailRow>

        {event.is_calendly_booking ? (
          <>
            {event.calendly_event_type ? (
              <DetailRow label="Event type">{event.calendly_event_type}</DetailRow>
            ) : null}
            {event.calendly_invitee_name || event.calendly_invitee_email ? (
              <DetailRow label="Invitee">
                <div className="flex flex-col">
                  {event.calendly_invitee_name ? (
                    <span className="font-medium">{event.calendly_invitee_name}</span>
                  ) : null}
                  {event.calendly_invitee_email ? (
                    <span className="text-xs text-muted-foreground">
                      {event.calendly_invitee_email}
                    </span>
                  ) : null}
                </div>
              </DetailRow>
            ) : null}
          </>
        ) : (
          <DetailRow label="Attendees">
            {event.attendee_count
              ? `${event.attendee_count} attendee${event.attendee_count === 1 ? "" : "s"}`
              : "—"}
          </DetailRow>
        )}

        {event.gcal_title && event.calendly_event_type ? (
          <DetailRow label="On Google Calendar as">
            <span className="text-xs">{event.gcal_title}</span>
          </DetailRow>
        ) : null}

        {qa && qa.length > 0 ? (
          <div className="space-y-2 rounded-lg border border-border bg-secondary/30 p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Booking form answers
            </p>
            <dl className="space-y-2">
              {qa.map((item, i) => (
                <div key={i}>
                  <dt className="text-xs text-muted-foreground">{item.question}</dt>
                  <dd className="mt-0.5 text-sm">{item.answer}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>
    </dialog>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-baseline gap-3">
      <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
