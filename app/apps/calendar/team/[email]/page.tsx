import Link from "next/link";
import { getIntervalsForUserWeek, getCloserTimezone } from "@/lib/availability";
import { WeekTimeline } from "@/components/WeekTimeline";
import { TeamFilters } from "@/components/TeamFilters";

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

const fmtDayLong = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: tz,
  }).format(new Date(iso + "T12:00:00Z"));

const windowLabel = (days: number) =>
  days === 1
    ? "1-day"
    : days === 7
    ? "1-week"
    : days === 14
    ? "2-week"
    : `${days}-day`;

export default async function PersonPage(props: PageProps<"/apps/calendar/team/[email]">) {
  const params = await props.params;
  const search = await props.searchParams;
  const email = decodeURIComponent(params.email);

  // Default to the closer's own calendar TZ if known; user can override via ?tz=
  const closerTz = await getCloserTimezone(email);
  const tz = pickStr(search.tz, closerTz ?? "America/New_York");
  const dateFrom = pickStr(search.date, todayInTz(tz));
  const days = pickInt(search.days, 7);

  const intervals = await getIntervalsForUserWeek({
    email,
    dateFrom,
    daysCount: days,
    tz,
  });

  // Back to the calendar root with NO carried params — team-page filter
  // changes must not bleed into the main dashboard's filter state.
  const backHref = "/apps/calendar";
  const shortName = email.split("@")[0];

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-4">
          <Link
            href={backHref}
            className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground hover:text-accent"
          >
            ← Back
          </Link>
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            {shortName}
          </h1>
          <span className="text-xs text-muted-foreground">{email}</span>
        </div>
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {windowLabel(days)} &middot;{" "}
          {days === 1 ? fmtDayLong(dateFrom, tz) : `${days} days from ${fmtDayLong(dateFrom, tz)}`}
        </p>
      </header>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <TeamFilters
          email={email}
          defaultDate={dateFrom}
          defaultDays={days}
          defaultTz={tz}
        />
      </section>

      <WeekTimeline
        intervals={intervals}
        dateFrom={dateFrom}
        daysCount={days}
        tz={tz}
      />
    </main>
  );
}
