import Link from "next/link";
import { PrintButton } from "../PrintButton";

export const metadata = {
  title: "Webinar Performance dashboard · NMM SOPs",
};

export default function WebinarPerformanceSop() {
  return (
    <main className="sop-container">
      <header className="sop-hero">
        <p className="sop-eyebrow">No More Mondays · Reporting</p>
        <h1 className="sop-h1">Webinar Performance dashboard</h1>
        <p className="sop-lead">
          Per-webinar breakdown of every Sunday and Wednesday event
          since launch. Spend → Registrations → Attendance → Bookings →
          Shows → Deals → Cash, with cost-efficiency derivations
          alongside. Pulls from{" "}
          <code>dbt_tuddin.mart_webinar_events</code>.
        </p>
        <div className="sop-toolbar">
          <Link className="sop-btn" href="/dashboards/webinar">
            Open the dashboard
          </Link>
          <PrintButton />
        </div>
      </header>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">01</span>
          <h2 className="sop-h2">What it answers</h2>
        </div>
        <ul>
          <li>Which webinars drove the most cash per dollar spent?</li>
          <li>How are Sunday vs Wednesday webinars trending?</li>
          <li>Where did the funnel break this week &mdash; reg, attend, book, show, or close?</li>
          <li>Which era of webinar (pre/post format change) performed best?</li>
        </ul>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">02</span>
          <h2 className="sop-h2">Filters</h2>
        </div>
        <ul>
          <li>
            <strong>Day</strong> &mdash; Sunday / Wednesday. Empty =
            both.
          </li>
          <li>
            <strong>Era</strong> &mdash; <code>data_era</code> tag from
            the mart (e.g. pre/post a format change). Used to compare
            apples-to-apples.
          </li>
          <li>
            <strong>From / To</strong> &mdash; date range. Defaults to
            all-time.
          </li>
          <li>
            <strong>View</strong> &mdash; Overview (KPI cards + chart) or
            Detail (per-webinar table).
          </li>
          <li>
            <strong>Granularity</strong> &mdash; chart x-axis: per
            webinar / day / week / month / year. Per-webinar gives the
            most detail; week is the right roll-up for trend reading.
          </li>
          <li>
            <strong>Sort + dir</strong> &mdash; in Detail view, sort by
            any column.
          </li>
        </ul>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">03</span>
          <h2 className="sop-h2">Drilling into one webinar</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> The list-level numbers tell you which
          event was the outlier; the per-event page tells you why.
        </p>
        <ol>
          <li>
            From the Detail view, click a webinar date. You land on{" "}
            <code>/dashboards/webinar/[date]</code>.
          </li>
          <li>
            That page exposes everything the weekly report Tab 2 also
            shows: registrations by channel, Meta funnel (Impressions →
            Link Clicks → Conversions), cost-per-this and
            cost-per-that, the reactivation funnel, and Cash + ROAS.
          </li>
          <li>
            Dev Mode (admin) reveals the SQL behind every cell.
          </li>
        </ol>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">04</span>
          <h2 className="sop-h2">Dev Mode</h2>
        </div>
        <p>
          Same shared cookie as the other dashboards. Toggling Dev Mode
          here also flips it on the Sales / Setter / Weekly Report /
          High-Level dashboards.
        </p>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">05</span>
          <h2 className="sop-h2">When numbers look wrong</h2>
        </div>
        <ul>
          <li>
            <strong>Latest webinar row is partial:</strong> the cycle is
            in-flight. Shows / Deals / Cash will fill in over the next
            48&ndash;72h.
          </li>
          <li>
            <strong>Cost / Attendee jumps without an ad spend change:</strong>{" "}
            Zoom attendee count is best-session deduped. A small Zoom
            change can swing the denominator. Compare to the GHL
            registrants attend rate for sanity.
          </li>
          <li>
            <strong>Reactivation columns are 0 but you ran a push:</strong>{" "}
            the reactivation flag in the mart needs to be wired for the
            specific cycle &mdash; check the <code>is_reactivation_data_available</code> column.
          </li>
        </ul>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">06</span>
          <h2 className="sop-h2">Related SOPs</h2>
        </div>
        <ul>
          <li>
            <Link className="sop-link" href="/sops/weekly-report">
              Weekly Report dashboard
            </Link>{" "}
            &mdash; Tab 2 is the snapshotted version of this dashboard
            for the last 3 webinars.
          </li>
          <li>
            <Link className="sop-link" href="/sops/high-level-dashboard">
              High-Level (CEO) dashboard
            </Link>{" "}
            &mdash; the daily rollup that aggregates these webinar
            cycles.
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
