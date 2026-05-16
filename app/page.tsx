import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { SopsRail, type SopRailEntry } from "./SopsRail";
import { AuthButtons } from "./AuthButtons";

type Tile = {
  href: string;
  title: string;
  description: string;
  status: "live" | "coming_soon";
  external?: boolean;
};

const apps: Tile[] = [
  {
    href: "/apps/calendar",
    title: "Calendar Capacity",
    description:
      "Booking capacity across closers. Pulls Google Calendar + Calendly via BigQuery.",
    status: "live",
  },
  {
    href: "/apps/calendly-search",
    title: "Calendly Internal Note Search",
    description:
      "Find bookings whose event-type internal note matches a query (setter, vip, webinar, …). Live Calendly API.",
    status: "live",
  },
];

const dashboards: Tile[] = [
  {
    href: "/dashboards/high-level",
    title: "High-Level CEO",
    description:
      "Daily marketing + sales + sales-cycle rollup across all funnels (Meta-wide ad spend, booked calls, show rate, ROAS). Live from BigQuery.",
    status: "live",
  },
  {
    href: "/dashboards/webinar",
    title: "Webinar Performance",
    description:
      "End-to-end webinar funnel — spend, registrations, attendance, calls, revenue, ROAS. Live from BigQuery, with per-webinar drill-through.",
    status: "live",
  },
  {
    href: "/dashboards/sales",
    title: "Sales Performance",
    description:
      "Per-closer rollup — calls, shows, deals, close rate, AOV, ACV, collection rate. Live over the closer mart; replaces Looker's closer dashboard.",
    status: "live",
  },
  {
    href: "/dashboards/setter",
    title: "Setter Performance",
    description:
      "Per-setter rollup — bookings, show rate, Setter DQ rate, qualified-show rate, deal contribution. Live over int_calls_enriched.",
    status: "live",
  },
  {
    href: "/dashboards/weekly-report",
    title: "Weekly Reports",
    description:
      "Monday recap + Thursday midweek snapshots. Each report is its own page — webinar performance, sales funnel, closer perf, and strategic insights. Live from BigQuery.",
    status: "live",
  },
];

const sops: SopRailEntry[] = [
  {
    href: "https://www.notion.so/nomoremondays/SOP-Weekly-Report-Monday-recap-Thursday-midweek-check-3629b9a6796a80818391ca056b4b0efc",
    external: true,
    title: "Weekly Report — Mon recap & Thu midweek",
    description:
      "Snapshot creation, the 6 tabs, AI insights, Solutions tabs, and Dev Mode for the exact SQL. (Notion)",
  },
  {
    href: "https://www.notion.so/nomoremondays/SOP-High-Level-CEO-Dashboard-3629b9a6796a805096c8e55cabba420c",
    external: true,
    title: "High-Level (CEO) dashboard",
    description:
      "Daily marketing + sales + sales-cycle rollup — the pre-standup scan. (Notion)",
  },
  {
    href: "https://www.notion.so/nomoremondays/SOP-Sales-Performance-3629b9a6796a809f9822fecf1f09a2d9",
    external: true,
    title: "Sales (Closer) Performance",
    description:
      "Per-closer rollup with cross-filters and Δ-vs-prior on every KPI. (Notion)",
  },
  {
    href: "https://www.notion.so/nomoremondays/SOP-Setter-Performance-Dashboard-3629b9a6796a80fe88cff0294415a19f",
    external: true,
    title: "Setter Performance",
    description:
      "Per-setter view including the $300/week bonus eligibility check. (Notion)",
  },
  {
    href: "https://www.notion.so/nomoremondays/SOP-Webinar-Performance-Dashboard-3629b9a6796a8007a796fe291db98bad",
    external: true,
    title: "Webinar Performance",
    description:
      "Per-webinar breakdown — spend, regs, attendance, bookings, cash, ROAS. (Notion)",
  },
  {
    href: "https://www.notion.so/nomoremondays/SOP-Weekly-Report-Monday-Solution-Writing-3629b9a6796a809480a4d7d49b1bdffb",
    external: true,
    title: "Solutions tabs (Alvaro & Ben)",
    description:
      "How to fill in the weekly Marketing / Sales Solutions tabs — template, what to look at, what not to post. (Notion)",
  },
  {
    href: "https://www.notion.so/nomoremondays/SOP-Funnel-Search-3629b9a6796a8009819ad89561108f89",
    external: true,
    title: "Funnel Search",
    description:
      "Trace one Calendly booking through the funnel by tag, closer, host, or status. (Notion)",
  },
  {
    href: "/sops/how-to-read-capacity-dashboard",
    title: "How to read the capacity dashboard",
    description:
      "What every chart, KPI, and matrix cell means on the team-availability dashboard.",
  },
  {
    href: "/sops/closer-calendar-management",
    title: "Calendar management for closers",
    description:
      "Share your calendar, block your busy time, set the right timezone.",
  },
  {
    href: "/sops/new-closer-joins",
    title: "When a new closer joins",
    description:
      "Ops walkthrough for onboarding a closer end-to-end.",
  },
  {
    href: "/sops/closer-removed",
    title: "When a closer is removed",
    description:
      "Cleanly remove a closer without breaking attribution.",
  },
];

function TileCard({ tile }: { tile: Tile }) {
  const isLive = tile.status === "live";
  const isExternal = isLive && tile.external === true;
  const inner = (
    <div
      className={
        "group flex h-full flex-col justify-between rounded-2xl border bg-card p-6 shadow-sm transition " +
        (isLive
          ? "border-border hover:border-accent hover:shadow-md cursor-pointer"
          : "border-dashed border-border opacity-70 cursor-not-allowed")
      }
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-heading text-lg font-semibold tracking-tight">
            {tile.title}
          </h3>
          {isExternal ? (
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              External
            </span>
          ) : !isLive ? (
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Coming soon
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{tile.description}</p>
      </div>
      {isLive ? (
        <div className="mt-6 text-xs font-medium uppercase tracking-[0.18em] text-accent">
          Open {isExternal ? "↗" : "→"}
        </div>
      ) : null}
    </div>
  );

  if (isExternal) {
    return (
      <a
        href={tile.href}
        target="_blank"
        rel="noopener noreferrer"
        className="block h-full"
      >
        {inner}
      </a>
    );
  }
  if (isLive) {
    return (
      <Link href={tile.href} className="block h-full">
        {inner}
      </Link>
    );
  }
  return <div className="h-full">{inner}</div>;
}

function Section({ title, tiles }: { title: string; tiles: Tile[] }) {
  return (
    <section className="space-y-4">
      <h2 className="font-heading text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <TileCard key={t.title} tile={t} />
        ))}
      </div>
    </section>
  );
}

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col lg:flex-row lg:items-stretch">
      <div className="min-w-0 flex-1">
        <main className="mx-auto w-full max-w-6xl space-y-10 p-6 md:p-10">
          <header className="space-y-2 border-b border-border pb-8">
            <div className="flex items-start justify-between gap-6">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
                  No More Mondays
                </p>
                <h1 className="font-heading text-4xl font-semibold tracking-tight md:text-5xl">
                  Internal apps &amp; dashboards
                </h1>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Pick a tool below. Apps are interactive workflows; dashboards
                  are analytics views.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {user?.isAdmin ? (
                  <Link
                    href="/admin"
                    className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground shadow-sm hover:border-accent hover:text-accent"
                  >
                    Admin
                  </Link>
                ) : null}
                <AuthButtons />
              </div>
            </div>
            {user ? (
              <p className="pt-1 text-xs text-muted-foreground">
                Signed in as{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  {user.email}
                </code>
              </p>
            ) : null}
          </header>

          <Section title="Apps" tiles={apps} />
          <Section title="Dashboards" tiles={dashboards} />
        </main>
      </div>

      <SopsRail sops={sops} />
    </div>
  );
}
