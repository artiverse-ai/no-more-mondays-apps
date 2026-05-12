import Link from "next/link";
import { getCurrentUser } from "@/lib/cf-access";

type Tile = {
  href: string;
  title: string;
  description: string;
  status: "live" | "coming_soon";
};

const apps: Tile[] = [
  {
    href: "/apps/calendar",
    title: "Team Calendar",
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
    href: "#",
    title: "Webinar Performance",
    description:
      "End-to-end webinar funnel — spend, registrations, attendance, calls, revenue. Currently being rebuilt for this app.",
    status: "coming_soon",
  },
];

const sops: Tile[] = [
  {
    href: "/sops/how-to-read-capacity-dashboard",
    title: "How to read the capacity dashboard",
    description:
      "What every chart, KPI, and matrix cell means on the team-availability dashboard.",
    status: "live",
  },
  {
    href: "/sops/closer-calendar-management",
    title: "Calendar management for closers",
    description:
      "Share your calendar, block your busy time, set the right timezone — for new closers and as a reference.",
    status: "live",
  },
  {
    href: "/sops/new-closer-joins",
    title: "When a new closer joins",
    description:
      "Ops walkthrough for onboarding a closer end-to-end: calendar share, active list, verification.",
    status: "live",
  },
  {
    href: "/sops/closer-removed",
    title: "When a closer is removed",
    description:
      "Cleanly remove a closer without breaking attribution or stranding their in-flight calls.",
    status: "live",
  },
];

function TileCard({ tile }: { tile: Tile }) {
  const isLive = tile.status === "live";
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
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg font-semibold tracking-tight">
            {tile.title}
          </h3>
          {isLive ? null : (
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Coming soon
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{tile.description}</p>
      </div>
      {isLive ? (
        <div className="mt-6 text-xs font-medium uppercase tracking-[0.18em] text-accent">
          Open &rarr;
        </div>
      ) : null}
    </div>
  );

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
              Pick a tool below. Apps are interactive workflows; dashboards are
              analytics views.
            </p>
          </div>
          {user?.isAdmin ? (
            <Link
              href="/admin"
              className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground shadow-sm hover:border-accent hover:text-accent"
            >
              Admin
            </Link>
          ) : null}
        </div>
        {user ? (
          <p className="pt-1 text-xs text-muted-foreground">
            Signed in as{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">{user.email}</code>
          </p>
        ) : null}
      </header>

      <Section title="Apps" tiles={apps} />
      <Section title="Dashboards" tiles={dashboards} />
      <Section title="SOPs" tiles={sops} />
    </main>
  );
}
