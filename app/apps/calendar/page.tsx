import Link from "next/link";
import { getRangeSlots, getTeamMembers } from "@/lib/availability";
import { getCurrentUser } from "@/lib/cf-access";
import { RangeFilters } from "@/components/RangeFilters";
import { SlotMatrix } from "@/components/SlotMatrix";
import { RangeDayChart } from "@/components/RangeDayChart";
import { RangePerCloserChart } from "@/components/RangePerCloserChart";
import { HeadlineKPIs } from "@/components/HeadlineKPIs";

const todayInTz = (tz: string): string => {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
};

const pickStr = (v: string | string[] | undefined, fallback: string): string =>
  typeof v === "string" ? v : fallback;

const pickInt = (v: string | string[] | undefined, fallback: number): number => {
  if (typeof v !== "string") return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

const fmtRange = (from: string, to: string, tz: string) => {
  const f = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: tz });
  const fromStr = f.format(new Date(from + "T12:00:00Z"));
  const toStr = f.format(new Date(to + "T12:00:00Z"));
  return from === to ? fromStr : `${fromStr} → ${toStr}`;
};

const shiftDay = (iso: string, days: number): string => {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
};

function defaultRange(tz: string): { from: string; to: string } {
  // Default to the upcoming Monday-through-Friday workweek in the selected
  // timezone. If today is Mon-Thu we still jump to NEXT Monday — bookings
  // typically need at least a day's notice and aiming the dashboard at a
  // fresh week is the most common ops question.
  const today = todayInTz(tz);
  const [y, m, d] = today.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  // 0 = Sun, 1 = Mon, ..., 6 = Sat. Days until the *next* Monday (today if
  // today is already Monday wraps to next Monday for the same reason: avoid
  // showing the week we're already inside).
  const dow = dt.getUTCDay();
  const daysUntilNextMonday = ((8 - dow) % 7) || 7;
  dt.setUTCDate(dt.getUTCDate() + daysUntilNextMonday);
  const monday = dt.toISOString().slice(0, 10);
  return { from: monday, to: shiftDay(monday, 4) };
}

export default async function Page(props: PageProps<"/apps/calendar">) {
  const params = await props.searchParams;

  const tz = pickStr(params.tz, "America/New_York");
  const def = defaultRange(tz);
  const fromDate = pickStr(params.from, pickStr(params.date, def.from));
  const toDate = pickStr(params.to, pickStr(params.date, def.to));
  const duration = pickInt(params.duration, 60);
  // Slot interval is auto-derived from call length: 45-min calls open every
  // hour, 60-min calls open every 1h 30m. Hide this from the user.
  const interval = duration === 45 ? 60 : 90;
  const teamParam = pickStr(params.team, "");
  const selectedTeam = teamParam.split(",").map((s) => s.trim()).filter(Boolean);

  const [slots, members, currentUser] = await Promise.all([
    getRangeSlots({
      fromDate,
      toDate,
      durationMin: duration,
      intervalMin: interval,
      tz,
      emails: selectedTeam.length > 0 ? selectedTeam : undefined,
    }),
    getTeamMembers(),
    getCurrentUser(),
  ]);

  const effectiveMembers = selectedTeam.length > 0 ? selectedTeam : members;
  const effectiveTeamSize = effectiveMembers.length;

  // Per-day buckets for the headroom chart. Each bar = total available
  // capacity that day (sum of free-closer counts = max simultaneous calls).
  const dayBuckets = (() => {
    const m = new Map<string, { capacity: number; max: number; bookable: number; total: number }>();
    for (const s of slots) {
      const cur = m.get(s.slot_date) || { capacity: 0, max: 0, bookable: 0, total: 0 };
      cur.capacity += s.available_count;
      cur.max += effectiveTeamSize;
      cur.total += 1;
      if (s.available_count > 0) cur.bookable += 1;
      m.set(s.slot_date, cur);
    }
    return Array.from(m.entries())
      .sort()
      .map(([slot_date, v]) => ({
        slot_date,
        available_capacity: v.capacity,
        max_capacity: v.max,
        bookable_slots: v.bookable,
        total_slots: v.total,
      }));
  })();

  // Headline numbers
  const totalSlots = slots.length;
  const bookableSlots = slots.filter((s) => s.available_count > 0).length;

  return (
    <main className="mx-auto max-w-[1600px] space-y-8 p-4 md:p-8 lg:p-10">
      {/* Hero */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-8">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
            No More Mondays &middot; Sales Ops
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight md:text-5xl">
            Calendar Capacity
          </h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <p className="text-sm text-muted-foreground">
            {members.length} active &amp; available closer
            {members.length === 1 ? "" : "s"} &middot; {tz}
          </p>
          <div className="flex items-center gap-3">
            {currentUser?.isAdmin ? (
              <Link
                href="/admin"
                className="rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground shadow-sm hover:border-accent hover:text-accent"
              >
                Admin
              </Link>
            ) : null}
            <Link
              href="/sops/how-to-read-capacity-dashboard"
              className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground hover:text-accent"
            >
              How to read this →
            </Link>
          </div>
        </div>
      </header>

      {/* Filters */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <RangeFilters
          defaultFrom={fromDate}
          defaultTo={toDate}
          defaultDuration={duration}
          defaultTz={tz}
          allMembers={members}
          selectedTeam={selectedTeam}
        />
        <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{duration}-minute</span>{" "}
          calls bookable every{" "}
          <span className="font-semibold text-foreground">
            {Math.floor(interval / 60)}h{interval % 60 ? ` ${interval % 60}m` : ""}
          </span>{" "}
          across <span className="font-semibold text-foreground">{fmtRange(fromDate, toDate, tz)}</span>{" "}
          for <span className="font-semibold text-foreground">{effectiveTeamSize} closer{effectiveTeamSize === 1 ? "" : "s"}</span>.
        </p>
      </section>

      {/* Headline KPIs — click for detail dialogs */}
      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">
          At a glance &mdash; {fmtRange(fromDate, toDate, tz)}
        </h2>
        <HeadlineKPIs
          slots={slots}
          members={effectiveMembers}
          effectiveTeamSize={effectiveTeamSize}
          fromDate={fromDate}
          toDate={toDate}
          rangeLabel={fmtRange(fromDate, toDate, tz)}
          tz={tz}
        />
      </section>

      {/* Charts side-by-side: per-day available + per-closer split */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RangeDayChart
          buckets={dayBuckets}
          slots={slots}
          members={effectiveMembers}
          tz={tz}
        />
        <RangePerCloserChart
          slots={slots}
          members={effectiveMembers}
          totalSlots={totalSlots}
          fromDate={fromDate}
          toDate={toDate}
          daysCount={dayBuckets.length}
          tz={tz}
          selectedTeam={selectedTeam}
        />
      </section>

      {/* Slot matrix */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Slot matrix
            </p>
            <h2 className="font-heading text-2xl font-semibold tracking-tight">
              Availability by slot &amp; day
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              cell = number of free closers in that slot. totals = bookable slots (with ≥1 closer free).
            </p>
          </div>
        </div>
        <SlotMatrix
          slots={slots}
          totalMembers={effectiveTeamSize}
          tz={tz}
          durationMin={duration}
        />
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-2 font-heading text-3xl font-semibold tabular-nums ${
          accent ? "text-accent" : "text-foreground"
        }`}
      >
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}
