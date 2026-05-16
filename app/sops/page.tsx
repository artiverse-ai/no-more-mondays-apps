import Link from "next/link";

type SopEntry = {
  href: string;
  external: boolean;
  title: string;
  audience: string;
  description: string;
};

type SopGroup = { title: string; sops: SopEntry[] };

const SOP_GROUPS: SopGroup[] = [
  {
    title: "Reporting dashboards",
    sops: [
      {
        href: "https://www.notion.so/nomoremondays/SOP-Weekly-Report-Monday-recap-Thursday-midweek-check-3629b9a6796a80818391ca056b4b0efc",
        external: true,
        title: "Weekly Report — Monday recap & Thursday midweek",
        audience: "Leadership · Marketing · Sales",
        description:
          "How the two report formats differ, how to create a snapshot, what each tab covers, the AI insights pipeline, and Dev Mode for surfacing the exact SQL. (Notion)",
      },
      {
        href: "https://www.notion.so/nomoremondays/SOP-High-Level-CEO-Dashboard-3629b9a6796a805096c8e55cabba420c",
        external: true,
        title: "High-Level (CEO) dashboard",
        audience: "CEO · Leadership",
        description:
          "Daily marketing + sales + sales-cycle rollup. The pre-standup scan: cash, TCV, ad spend, ROAS, OCC/FUC cycle times. (Notion)",
      },
      {
        href: "https://www.notion.so/nomoremondays/SOP-Sales-Performance-3629b9a6796a809f9822fecf1f09a2d9",
        external: true,
        title: "Sales (Closer) Performance dashboard",
        audience: "Sales managers · CEO",
        description:
          "Every call rolled up by closer with cross-filters for source / setter / outcome / OCC·FUC. Δ-vs-prior pills on every KPI. (Notion)",
      },
      {
        href: "/sops/setter-performance-dashboard",
        external: false,
        title: "Setter Performance dashboard",
        audience: "Sales managers · Setters",
        description:
          "Same call data, setter perspective. Show rate, Setter DQ rate, cash per booking, and the $300/week bonus eligibility view.",
      },
      {
        href: "/sops/webinar-performance-dashboard",
        external: false,
        title: "Webinar Performance dashboard",
        audience: "Marketing · CEO",
        description:
          "Per-webinar breakdown of every Sun + Wed event since launch. Spend, registration, attendance, bookings, cash, ROAS — plus the drill-down to a single webinar.",
      },
      {
        href: "https://www.notion.so/nomoremondays/SOP-Weekly-Report-Monday-Solution-Writing-3629b9a6796a809480a4d7d49b1bdffb",
        external: true,
        title: "Filling in the Solutions tabs (Alvaro & Ben)",
        audience: "Alvaro · Ben · Admins",
        description:
          "When to post, what to look at first, the 3-question template for a useful solution, and what NOT to post on the Marketing/Sales Solutions tabs. (Notion)",
      },
    ],
  },
  {
    title: "Sales ops tooling",
    sops: [
      {
        href: "/sops/how-to-read-capacity-dashboard",
        external: false,
        title: "How to read the capacity dashboard",
        audience: "Ops · Sales managers",
        description:
          "What each chart and number on the team-availability dashboard means, how to filter, and what to do when something looks off.",
      },
      {
        href: "/sops/funnel-search",
        external: false,
        title: "Funnel Search",
        audience: "Sales ops · Marketing",
        description:
          "Find Calendly bookings by funnel tag, then narrow by closer / host / status. The fast way to trace one deal end-to-end.",
      },
      {
        href: "/sops/closer-calendar-management",
        external: false,
        title: "Calendar management for closers",
        audience: "Closers",
        description:
          "Share your calendar, block your busy time, set the right timezone — five minutes once, three minutes a week.",
      },
      {
        href: "/sops/new-closer-joins",
        external: false,
        title: "When a new closer joins",
        audience: "Ops",
        description:
          "The walkthrough for adding a new closer: get their calendar shared, add them to the active list, verify they appear in the dashboard.",
      },
      {
        href: "/sops/closer-removed",
        external: false,
        title: "When a closer is removed",
        audience: "Ops",
        description:
          "How to cleanly remove a closer from the booking system without breaking attribution, and what to do with their in-flight calls.",
      },
    ],
  },
];

export const metadata = {
  title: "SOPs · No More Mondays",
};

function Card({ sop }: { sop: SopEntry }) {
  const body = (
    <>
      <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
        <span className="sop-eyebrow" style={{ margin: 0 }}>
          {sop.audience}
        </span>
        {sop.external ? (
          <span
            className="sop-eyebrow"
            style={{ margin: 0, opacity: 0.6 }}
            aria-label="External link"
          >
            ↗ External
          </span>
        ) : null}
      </div>
      <h2 className="sop-h2" style={{ marginBottom: 8 }}>
        {sop.title}
      </h2>
      <p style={{ color: "var(--muted-foreground)", fontSize: 14, margin: 0 }}>
        {sop.description}
      </p>
    </>
  );
  if (sop.external) {
    return (
      <a
        key={sop.href}
        href={sop.href}
        target="_blank"
        rel="noopener noreferrer"
        className="sop-card block transition hover:border-accent"
        style={{ marginBottom: 0 }}
      >
        {body}
      </a>
    );
  }
  return (
    <Link
      key={sop.href}
      href={sop.href}
      className="sop-card block transition hover:border-accent"
      style={{ marginBottom: 0 }}
    >
      {body}
    </Link>
  );
}

export default function SopsIndexPage() {
  return (
    <main className="sop-container">
      <header className="sop-hero">
        <p className="sop-eyebrow">No More Mondays · Operations</p>
        <h1 className="sop-h1">Standard operating procedures</h1>
        <p className="sop-lead">
          The reference docs for how the booking system works and what to do
          when something changes. Bookmark the ones that touch your job. Each
          page is printable — Cmd/Ctrl-P for a clean PDF.
        </p>
      </header>

      <div className="space-y-8">
        {SOP_GROUPS.map((group) => (
          <section key={group.title}>
            <h2 className="sop-h2" style={{ marginBottom: 12, fontSize: 18 }}>
              {group.title}
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {group.sops.map((sop) => (
                <Card key={sop.href} sop={sop} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <footer className="sop-footer">
        Maintained by ops. Spot something out of date? Email{" "}
        <a className="sop-link" href="mailto:ops@nomoremondays.io">
          ops@nomoremondays.io
        </a>{" "}
        or open a PR on{" "}
        <a
          className="sop-link"
          href="https://github.com/artiverse-ai/no-more-mondays-apps"
        >
          no-more-mondays-apps
        </a>
        .
      </footer>
    </main>
  );
}
