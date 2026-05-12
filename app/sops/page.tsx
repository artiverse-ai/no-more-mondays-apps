import Link from "next/link";

type SopEntry = {
  slug: string;
  title: string;
  audience: string;
  description: string;
};

const SOPS: SopEntry[] = [
  {
    slug: "how-to-read-capacity-dashboard",
    title: "How to read the capacity dashboard",
    audience: "Ops · Sales managers",
    description:
      "What each chart and number on the team-availability dashboard means, how to filter, and what to do when something looks off.",
  },
  {
    slug: "closer-calendar-management",
    title: "Calendar management for closers",
    audience: "Closers",
    description:
      "Share your calendar, block your busy time, set the right timezone — five minutes once, three minutes a week.",
  },
  {
    slug: "new-closer-joins",
    title: "When a new closer joins",
    audience: "Ops",
    description:
      "The walkthrough for adding a new closer: get their calendar shared, add them to the active list, verify they appear in the dashboard.",
  },
  {
    slug: "closer-removed",
    title: "When a closer is removed",
    audience: "Ops",
    description:
      "How to cleanly remove a closer from the booking system without breaking attribution, and what to do with their in-flight calls.",
  },
];

export const metadata = {
  title: "SOPs · No More Mondays",
};

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

      <div className="grid grid-cols-1 gap-3">
        {SOPS.map((sop) => (
          <Link
            key={sop.slug}
            href={`/sops/${sop.slug}`}
            className="sop-card block transition hover:border-accent"
            style={{ marginBottom: 0 }}
          >
            <p className="sop-eyebrow" style={{ marginBottom: 6 }}>
              {sop.audience}
            </p>
            <h2 className="sop-h2" style={{ marginBottom: 8 }}>
              {sop.title}
            </h2>
            <p style={{ color: "var(--muted-foreground)", fontSize: 14, margin: 0 }}>
              {sop.description}
            </p>
          </Link>
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
