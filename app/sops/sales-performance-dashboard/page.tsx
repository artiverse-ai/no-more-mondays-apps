import Link from "next/link";
import { PrintButton } from "../PrintButton";

export const metadata = {
  title: "Sales (Closer) Performance dashboard · NMM SOPs",
};

export default function SalesPerformanceSop() {
  return (
    <main className="sop-container">
      <header className="sop-hero">
        <p className="sop-eyebrow">No More Mondays · Reporting</p>
        <h1 className="sop-h1">Sales Performance &mdash; Closer dashboard</h1>
        <p className="sop-lead">
          Every call that hit a closer&rsquo;s calendar, rolled up by
          closer with cross-filters for source / setter / outcome /
          OCC&middot;FUC. Lives on{" "}
          <code>dbt_tuddin.int_calls_enriched</code> with the PR-#43
          show-rate fix. Cross-filter chips never shrink as you select
          &mdash; they always show the full option list from unfiltered
          data.
        </p>
        <div className="sop-toolbar">
          <Link className="sop-btn" href="/dashboards/sales">
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
          <li>Which closer brought in the most cash this week / month?</li>
          <li>Who has the best show rate? Best close rate (Shows vs CQ basis)?</li>
          <li>Are there outliers in OCC vs FUC days that hint at process drift?</li>
          <li>What does the funnel look like when filtered to one setter, one source, one outcome?</li>
        </ul>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">02</span>
          <h2 className="sop-h2">Period picker + Δ-vs-prior</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> Every KPI is paired with its
          equal-length prior-period delta so you don&rsquo;t have to do
          mental math.
        </p>
        <ul>
          <li>
            Default: <strong>This week</strong>. The dashboard
            automatically queries the equal-length prior window in
            parallel.
          </li>
          <li>
            <strong>Δ pills</strong> next to each KPI show absolute and
            % change. Sign-aware coloring (green up, red down) per metric
            polarity.
          </li>
          <li>
            <strong>Custom range:</strong> use the date picker. The
            prior window automatically shifts back by the same number of
            days.
          </li>
        </ul>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">03</span>
          <h2 className="sop-h2">Cross-filters</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> Cross-filters compose &mdash; pick a
          closer, then a source, then an outcome to surface the exact
          slice.
        </p>
        <ul>
          <li>
            <strong>Source</strong> &mdash; Webinar / Setter / Affiliate
            / Website / Skool / Lead Magnet. Pulls from{" "}
            <code>final_marketing_flow</code>.
          </li>
          <li>
            <strong>Closer</strong>, <strong>Setter</strong> &mdash;
            assignee chips.
          </li>
          <li>
            <strong>Triage / Call Outcome / OCC·FUC</strong> &mdash;
            disposition state and close type.
          </li>
          <li>
            <strong>Email search</strong> &mdash; partial match against{" "}
            <code>prospect_email_lc</code>. Useful for tracing one deal
            end-to-end.
          </li>
        </ul>
        <p className="sop-callout">
          <strong>Filter chips never shrink.</strong> The full option
          list is derived from <em>unfiltered</em> data so you can always
          un-narrow without scrolling.
        </p>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">04</span>
          <h2 className="sop-h2">The funnel + per-closer rollup</h2>
        </div>
        <ul>
          <li>
            <strong>Funnel counts</strong>: Prospects → Pros (D&rsquo;d)
            → Setter DQ / Pros (SQ) → Shows → Qualified Shows → Deals,
            with prior-period deltas inline.
          </li>
          <li>
            <strong>Per-closer rollup table</strong>: 15+ columns. Sort
            by Cash by default. Click any column header to re-sort.
          </li>
          <li>
            <strong>Detail view</strong> (tab toggle): one row per call.
            Useful when an aggregate looks suspicious &mdash; jump to
            the source rows.
          </li>
        </ul>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">05</span>
          <h2 className="sop-h2">Dev Mode &mdash; resolved SQL</h2>
        </div>
        <p>
          Admin only. Click <strong>Dev</strong> in the header to toggle.
          Each KPI grows an <code>(i)</code> badge revealing its
          formula, source column, and any inline-substituted filter
          values.
        </p>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">06</span>
          <h2 className="sop-h2">When numbers look wrong</h2>
        </div>
        <ul>
          <li>
            <strong>Shows count is too high vs Qualified Shows:</strong>{" "}
            check Closer DQ counts. The PR-#43 fix ensures Setter DQs
            are excluded from shows, but a Closer DQ still counts as a
            show.
          </li>
          <li>
            <strong>Same closer appears with different cases:</strong>{" "}
            <code>closer_owner</code> is normalized in dbt &mdash; if you
            see &ldquo;Tyler&rdquo; and &ldquo;tyler&rdquo;, the
            normalization rule was bypassed. Ping data ops.
          </li>
          <li>
            <strong>Setter DQ Rate looks too high:</strong> remember the
            denominator is <em>Pros (D&rsquo;d)</em>, not Shows. A
            closer who only takes pre-qualified leads will show a low
            rate; the relevant comparison is to the team baseline.
          </li>
          <li>
            <strong>Cash and Deals don&rsquo;t match a contract:</strong>{" "}
            payment-plan + deposit logic lives in <code>is_deal</code> +{" "}
            <code>is_paid_in_full</code>. Use Dev Mode to verify which
            flag is being summed.
          </li>
        </ul>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">07</span>
          <h2 className="sop-h2">Related SOPs</h2>
        </div>
        <ul>
          <li>
            <Link className="sop-link" href="/sops/setter-performance-dashboard">
              Setter Performance dashboard
            </Link>{" "}
            &mdash; same data, setter-perspective.
          </li>
          <li>
            <Link className="sop-link" href="/sops/weekly-report">
              Weekly Report dashboard
            </Link>{" "}
            &mdash; the snapshotted Mon/Thu retro using the same closer
            rollup.
          </li>
          <li>
            <Link className="sop-link" href="/sops/funnel-search">
              Funnel Search
            </Link>{" "}
            &mdash; trace one Calendly booking through the funnel.
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
