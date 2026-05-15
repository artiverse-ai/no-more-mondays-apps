import Link from "next/link";
import { PrintButton } from "../PrintButton";

export const metadata = {
  title: "Funnel Search · NMM SOPs",
};

export default function FunnelSearchSop() {
  return (
    <main className="sop-container">
      <header className="sop-hero">
        <p className="sop-eyebrow">No More Mondays · Sales Ops</p>
        <h1 className="sop-h1">Funnel Search</h1>
        <p className="sop-lead">
          Find Calendly bookings by funnel tag &mdash; then narrow by
          closer scope, host, or status. The fast way to trace one deal,
          one campaign, or one bug from booking through close.
        </p>
        <div className="sop-toolbar">
          <Link className="sop-btn" href="/apps/calendly-search">
            Open Funnel Search
          </Link>
          <PrintButton />
        </div>
      </header>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">01</span>
          <h2 className="sop-h2">What it&rsquo;s for</h2>
        </div>
        <ul>
          <li>
            <strong>Trace a specific call</strong> end-to-end &mdash; from
            the funnel tag at booking through who held it, what the
            outcome was, and what the prospect answered on the form.
          </li>
          <li>
            <strong>Audit a funnel/campaign</strong> &mdash; pull every
            booking that carried a specific UTM/event tag.
          </li>
          <li>
            <strong>QA new funnel routing</strong> &mdash; when you ship
            a new ad funnel, search by the tag to confirm bookings are
            being attributed correctly.
          </li>
        </ul>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">02</span>
          <h2 className="sop-h2">How search works</h2>
        </div>
        <ol>
          <li>
            Type a <strong>funnel tag</strong> (or partial) into the
            search box. The dropdown shows matching tags ranked by
            recency.
          </li>
          <li>
            Pick a tag. The result list populates with every Calendly
            booking carrying that tag.
          </li>
          <li>
            Refine with the filters: closer scope (all / specific
            closer), Calendly host, status (active / canceled /
            rescheduled).
          </li>
          <li>
            Click any row to expand &mdash; you see the prospect&rsquo;s
            answers to the booking-form questions, the host, the
            outcome (held / no-show / canceled / rescheduled).
          </li>
        </ol>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">03</span>
          <h2 className="sop-h2">When to use this vs. another dashboard</h2>
        </div>
        <ul>
          <li>
            <strong>One prospect or one deal</strong> &mdash; use this.
            The Sales / Setter dashboards roll up to numbers; this shows
            the underlying call rows.
          </li>
          <li>
            <strong>Volume / rate questions</strong> (&ldquo;how many
            Sunday-webinar bookings did we get?&rdquo;) &mdash; use the{" "}
            <Link className="sop-link" href="/sops/sales-performance-dashboard">
              Sales dashboard
            </Link>{" "}
            cross-filters.
          </li>
          <li>
            <strong>Webinar-level reads</strong> &mdash; use the{" "}
            <Link className="sop-link" href="/sops/webinar-performance-dashboard">
              Webinar dashboard
            </Link>
            .
          </li>
        </ul>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">04</span>
          <h2 className="sop-h2">When results look wrong</h2>
        </div>
        <ul>
          <li>
            <strong>Expected booking doesn&rsquo;t appear:</strong> check
            the funnel tag spelling &mdash; tags are case-insensitive
            but punctuation-sensitive.
          </li>
          <li>
            <strong>Booking has no host:</strong> Calendly didn&rsquo;t
            push the host name to the webhook. Open the Calendly admin
            and re-link the event type.
          </li>
          <li>
            <strong>Form answers are missing:</strong> the answer-capture
            field is null when the prospect skipped the question (most
            optional fields). Not a bug.
          </li>
        </ul>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">05</span>
          <h2 className="sop-h2">Related SOPs</h2>
        </div>
        <ul>
          <li>
            <Link className="sop-link" href="/sops/sales-performance-dashboard">
              Sales (Closer) Performance dashboard
            </Link>
          </li>
          <li>
            <Link className="sop-link" href="/sops/setter-performance-dashboard">
              Setter Performance dashboard
            </Link>
          </li>
          <li>
            <Link className="sop-link" href="/sops/how-to-read-capacity-dashboard">
              How to read the capacity dashboard
            </Link>{" "}
            &mdash; same Calendly source data, capacity perspective.
          </li>
        </ul>
      </section>

      <footer className="sop-footer">
        Spot a bug or have a feature ask? Open a PR or issue on{" "}
        <a className="sop-link" href="https://github.com/artiverse-ai/no-more-mondays-apps">
          no-more-mondays-apps
        </a>
        .
      </footer>
    </main>
  );
}
