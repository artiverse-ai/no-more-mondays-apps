import Link from "next/link";
import { PrintButton } from "../PrintButton";

export const metadata = {
  title: "Setter Performance dashboard · NMM SOPs",
};

export default function SetterPerformanceSop() {
  return (
    <main className="sop-container">
      <header className="sop-hero">
        <p className="sop-eyebrow">No More Mondays · Reporting</p>
        <h1 className="sop-h1">Setter Performance dashboard</h1>
        <p className="sop-lead">
          Same calls table as the Sales dashboard, rolled up by setter
          instead of closer. Built to answer &ldquo;which setter is
          booking the right calls&rdquo; &mdash; not just volume, but
          show rate and downstream cash.
        </p>
        <div className="sop-toolbar">
          <Link className="sop-btn" href="/dashboards/setter">
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
          <li>Which setter booked the most calls? The most calls that <em>showed</em>?</li>
          <li>Whose Setter DQ rate is creeping up &mdash; an early signal of lead-quality drift?</li>
          <li>Cash per booking by setter &mdash; volume vs. quality trade-off.</li>
          <li>Bonus eligibility check (combined SR ≥ 80% AND combined Pros (SQ) ≥ 20).</li>
        </ul>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">02</span>
          <h2 className="sop-h2">Hero metrics &mdash; setter view</h2>
        </div>
        <ul>
          <li>
            <strong>Setter DQ Rate</strong> &mdash; Setter DQ / Pros
            (D&rsquo;d). Bake a baseline first &mdash; team average is
            the right comparison, not absolute thresholds.
          </li>
          <li>
            <strong>Show Rate</strong> &mdash; Shows / Pros (SQ).
            Reflects setter quality + reminder discipline.
          </li>
          <li>
            <strong>Cash per Booking</strong> &mdash; Cash from deals
            attributed to this setter / total Prospects they sourced.
            Volume-aware quality score.
          </li>
        </ul>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">03</span>
          <h2 className="sop-h2">Cross-filters</h2>
        </div>
        <p>
          Identical filter set to the{" "}
          <Link className="sop-link" href="/sops/sales-performance-dashboard">
            Sales dashboard
          </Link>{" "}
          &mdash; Source, Closer, Setter, Triage, Call Outcome, OCC·FUC,
          email search. Cross-filters compose; chip lists are derived
          from unfiltered data.
        </p>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">04</span>
          <h2 className="sop-h2">The per-setter rollup</h2>
        </div>
        <ul>
          <li>
            One row per setter. Volume (Pros, Pros-SQ, Shows), quality
            (Setter DQ Rate, Show Rate), downstream (Deals, Cash).
          </li>
          <li>
            Sort by Bookings by default. Click any header to re-sort.
          </li>
          <li>
            <strong>Detail view</strong> (tab toggle) flattens to one
            row per call &mdash; the audit trail when an aggregate
            looks suspect.
          </li>
        </ul>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">05</span>
          <h2 className="sop-h2">When numbers look wrong</h2>
        </div>
        <ul>
          <li>
            <strong>Setter has Bookings but 0 Shows:</strong> the cycle
            is mid-flight (calls haven&rsquo;t happened yet). Filter to
            a closed week.
          </li>
          <li>
            <strong>Setter shows up twice:</strong>{" "}
            <code>setter_owner</code> normalization escape. Ping data
            ops.
          </li>
          <li>
            <strong>Cash attribution looks off:</strong> cash is
            attributed by <code>is_deal</code> + <code>cash_collected</code>
            on the call row, not on the booking. A setter doesn&rsquo;t
            &ldquo;earn&rdquo; the cash unless their booking became a
            deal. Use Dev Mode to verify.
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
            <Link className="sop-link" href="/sops/sales-performance-dashboard">
              Sales (Closer) Performance dashboard
            </Link>
          </li>
          <li>
            <Link className="sop-link" href="/sops/weekly-report">
              Weekly Report dashboard
            </Link>{" "}
            &mdash; Setter Performance section in Tab 3 (Monday only).
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
