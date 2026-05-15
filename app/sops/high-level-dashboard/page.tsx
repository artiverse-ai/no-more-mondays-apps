import Link from "next/link";
import { PrintButton } from "../PrintButton";

export const metadata = {
  title: "High-Level (CEO) dashboard · NMM SOPs",
};

export default function HighLevelDashboardSop() {
  return (
    <main className="sop-container">
      <header className="sop-hero">
        <p className="sop-eyebrow">No More Mondays · Reporting</p>
        <h1 className="sop-h1">High-Level (CEO) dashboard</h1>
        <p className="sop-lead">
          The CEO dashboard is the daily marketing-plus-sales-plus-cycle
          rollup. One page, one source of truth (
          <code>dbt_tuddin.mart_high_level_daily</code>), no per-cycle
          drill-downs &mdash; built for a sub-10-second scan before
          standup.
        </p>
        <div className="sop-toolbar">
          <Link className="sop-btn" href="/dashboards/high-level">
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
        <p className="sop-why">
          <strong>Why:</strong> Before drilling into the per-call,
          per-webinar dashboards, you want the headline read.
        </p>
        <ul>
          <li>How much cash + TCV did we bring in over the selected period?</li>
          <li>What did we spend to acquire it (ROAS Cash / ROAS Revenue)?</li>
          <li>How is the booking funnel trending (book → show → close)?</li>
          <li>Are sales cycles getting faster or slower (OCC / FUC days)?</li>
        </ul>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">02</span>
          <h2 className="sop-h2">The period filter</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> Everything below the filter is scoped to
          the chosen window. The default <code>30d</code> answers
          &ldquo;how&rsquo;s the month going&rdquo;.
        </p>
        <ul>
          <li>
            <strong>Period chips:</strong> 7d / 30d / 90d / YTD / custom.
            Selecting a chip auto-suggests a granularity for the trend
            chart (day for 7d&middot;30d, week for 90d, month for YTD).
          </li>
          <li>
            <strong>Granularity override:</strong> the <code>?gran=</code>{" "}
            URL param lets you force day / week / month / year on any
            period.
          </li>
          <li>
            <strong>Date freshness:</strong> top-right pill shows the
            most recent <code>dbt_updated_at</code> &mdash; if it&rsquo;s
            &gt; 24h old, the dbt sync may be failing.
          </li>
        </ul>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">03</span>
          <h2 className="sop-h2">Hero KPIs (top 4 cards)</h2>
        </div>
        <ul>
          <li>
            <strong>Total Ad Spend</strong> &mdash; sum of{" "}
            <code>total_ad_spend</code> across all Meta campaigns in the
            window.
          </li>
          <li>
            <strong>Total Cash Collected</strong> &mdash; Fanbasis +
            Whop, upfront at close.
          </li>
          <li>
            <strong>Total Revenue (TCV)</strong> &mdash; total contracted
            value, regardless of how it&rsquo;s paid.
          </li>
          <li>
            <strong>Total Deals Closed</strong> &mdash; deal count.
          </li>
        </ul>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">04</span>
          <h2 className="sop-h2">Trend chart + secondary KPIs</h2>
        </div>
        <p>
          The line chart plots Cash / TCV / Ad Spend over time at the
          chosen granularity. Below it: ROAS Cash, ROAS Revenue, Cost per
          Booked Call, AOV, ACV, PIF Rate, Cash Collection Rate &mdash;
          plus median OCC and FUC days from the sales-cycles rollup.
        </p>
        <p className="sop-callout">
          <strong>Reading tip:</strong> a flat or declining ROAS Cash
          line with rising Ad Spend = a likely flag for next week&rsquo;s
          Monday report. Cross-check with the Weekly Report once it
          drops.
        </p>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">05</span>
          <h2 className="sop-h2">Dev Mode &mdash; see the SQL</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> Validate a number before escalating.
        </p>
        <p>
          Click the <strong>Dev</strong> toggle in the header (admin
          only). The <code>(i)</code> badges appear next to every KPI
          label. Hover/click to see the formula and source column &mdash;
          shared cookie with the other dashboards.
        </p>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">06</span>
          <h2 className="sop-h2">When numbers look wrong</h2>
        </div>
        <ul>
          <li>
            <strong>Today&rsquo;s row is missing:</strong> dbt sync
            hasn&rsquo;t run yet for today. Wait until ~6 AM ET; the
            mart updates daily, not intraday.
          </li>
          <li>
            <strong>Ad spend looks too low:</strong> Meta API can lag by
            up to 24h on conversions. Recent rows often revise upward
            the following day.
          </li>
          <li>
            <strong>Cash &amp; TCV swing in opposite directions:</strong>{" "}
            payment-plan deals weight TCV but not cash. Cross-check PIF
            Rate &mdash; a low PIF rate explains a Cash &lt;&lt; TCV gap.
          </li>
          <li>
            <strong>Stale data freshness pill:</strong> ping ops in{" "}
            <code>#data</code> &mdash; dbt scheduled run probably failed.
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
            <Link className="sop-link" href="/sops/weekly-report">
              Weekly Report dashboard
            </Link>{" "}
            &mdash; the Mon/Thu retro built off the same numbers.
          </li>
          <li>
            <Link className="sop-link" href="/sops/sales-performance-dashboard">
              Sales (Closer) Performance dashboard
            </Link>{" "}
            &mdash; per-call detail when CEO needs to drill in.
          </li>
          <li>
            <Link className="sop-link" href="/sops/webinar-performance-dashboard">
              Webinar Performance dashboard
            </Link>{" "}
            &mdash; per-webinar breakdown of registration → attendance →
            close.
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
