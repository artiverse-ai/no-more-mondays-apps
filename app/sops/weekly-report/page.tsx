import Link from "next/link";
import { PrintButton } from "../PrintButton";

export const metadata = {
  title: "Weekly Report dashboard · NMM SOPs",
};

export default function WeeklyReportSop() {
  return (
    <main className="sop-container">
      <header className="sop-hero">
        <p className="sop-eyebrow">No More Mondays · Reporting</p>
        <h1 className="sop-h1">Weekly Report — Monday recap & Thursday midweek check</h1>
        <p className="sop-lead">
          The weekly report is the single source of truth for &ldquo;how did
          the business do this week?&rdquo;. Two formats land each week: a
          Monday recap of the prior Sun&ndash;Sat, and a Thursday midweek
          check on the in-flight Sun&ndash;Wed window. Each report is a
          dated snapshot &mdash; once created it never re-runs the metrics,
          so what leadership reads on a Monday is exactly what was true
          when the snapshot was captured.
        </p>
        <div className="sop-toolbar">
          <Link className="sop-btn" href="/dashboards/weekly-report">
            Open the dashboard
          </Link>
          <PrintButton />
        </div>
      </header>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">01</span>
          <h2 className="sop-h2">Two report formats</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> The two reports answer different questions,
          so the layouts are deliberately different.
        </p>
        <ul>
          <li>
            <strong>Monday recap (6 tabs)</strong> &mdash; full retro on the
            prior Sun&ndash;Sat. Tabs: Overview / Latest Webinar / Last
            Week&rsquo;s Sales / AI Strategic Insights / Marketing
            Solutions / Sales Solutions. The &ldquo;Last Week&rsquo;s
            Sales&rdquo; tab is the deep dive &mdash; per-closer,
            per-setter, by booking mode, with week-over-week deltas.
          </li>
          <li>
            <strong>Thursday midweek check (5 tabs)</strong> &mdash; same
            KPI strip + Overview, but the &ldquo;Last Week&rsquo;s
            Sales&rdquo; tab is removed because the Wednesday cycle&rsquo;s
            sales haven&rsquo;t landed yet. The latest-webinar column
            shows partial cycle data with a <code>partial</code> tag.
          </li>
        </ul>
        <p className="sop-callout">
          <strong>Solutions tabs (Marketing + Sales)</strong> are preserved
          on <em>both</em> formats. Alvaro and Ben can edit them
          independently of the AI insights.
        </p>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">02</span>
          <h2 className="sop-h2">Creating a snapshot</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> Snapshots are admin-created on demand.
          There&rsquo;s no auto-run cron &mdash; you decide which Mon/Thu
          gets a report.
        </p>
        <ol>
          <li>
            On <Link className="sop-link" href="/dashboards/weekly-report">/dashboards/weekly-report</Link>,
            click <strong>+ Create snapshot</strong> (admin-only).
          </li>
          <li>
            Pick any past Monday or Thursday from the dropdown (last 12
            weeks). Future dates are not selectable. Existing snapshots
            show as &ldquo;already exists &mdash; Open&rdquo;; missing-data
            windows disable the Create button with a hover tooltip
            explaining what BQ table is empty.
          </li>
          <li>
            Click <strong>Create snapshot</strong>. The row goes into{" "}
            <code>pending</code> status. Within ~60 seconds the
            insights-generator VM picks it up, runs Claude on the live BQ
            data, and writes 8&ndash;12 insight cards plus the context
            banners.
          </li>
          <li>
            The page auto-polls every 5 seconds. When status flips to{" "}
            <code>succeeded</code>, the cards render.
          </li>
        </ol>
        <p className="sop-callout">
          <strong>Clicking a row anywhere</strong> opens it. The Delete
          button stops propagation so it never navigates by accident.
        </p>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">03</span>
          <h2 className="sop-h2">The persistent KPI strip</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> Five metrics live at the top of every tab
          so you never lose the headline read.
        </p>
        <ul>
          <li>
            <strong>Avg Webinar Show Rate</strong> &mdash; weighted Zoom
            attend rate across Sun + Wed webinars in the window. Target
            24%.
          </li>
          <li>
            <strong>% Tier 1 Leads</strong> &mdash; placeholder; mart
            fields land later this quarter.
          </li>
          <li>
            <strong>Blended Cash ROAS</strong> &mdash; Fanbasis cash /
            total Meta ad spend. Target 4&times;.
          </li>
          <li>
            <strong>CPL Blended</strong> &mdash; placeholder; denominator
            is the open item (#11.2 in the spec).
          </li>
          <li>
            <strong>Cash / Booked Call (DPC)</strong> &mdash; Sergio&rsquo;s
            KPI. Fanbasis cash / total Calendly bookings.
          </li>
        </ul>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">04</span>
          <h2 className="sop-h2">Tab 1 &middot; Overview</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> Headline money + funnel state, one
          screen. Read top-to-bottom on Monday morning.
        </p>
        <ul>
          <li>
            <strong>Section A &middot; Money + Cycle</strong> &mdash; Cash
            Collected, Revenue (TCV), ROAS (Cash / TCV), Ad Spend, Deals,
            AOV, ACV, PIF Rate, Cash Collection Rate, OCC/FUC
            median+average book-to-close time.
          </li>
          <li>
            <strong>Section B &middot; Marketing Efficiency</strong>
            &mdash; Total Calls Booked (with Active sub-line), Cost/Booked
            Call, Cash/Booked Call, Avg Webinar Show Rate, CPL Blended.
          </li>
          <li>
            <strong>Section C &middot; Sales Funnel</strong> &mdash; 5
            stages (Prospects &rarr; Prospects-SQ &rarr; Shows &rarr;
            Qualified Shows &rarr; Deals), plus 5 funnel rates (Show
            Rate, Close Rate Shows, Close Rate CQ, Setter DQ Rate, Closer
            DQ Rate), plus 6 prospect-efficiency cards.
          </li>
        </ul>
        <p>
          Every label has a hover tooltip with the exact formula and BQ
          source. Hover anywhere on the metric name &mdash; no click
          needed.
        </p>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">05</span>
          <h2 className="sop-h2">Tab 2 &middot; Latest Webinar</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> One vertical column per webinar
          (latest&nbsp;3) so you can spot week-over-week shifts at a
          glance.
        </p>
        <ul>
          <li>
            <strong>Top-of-Funnel Comparison</strong> &mdash; Registration
            / Attendance / Meta Funnel / Cost Efficiency / Sales
            sub-sections, each row is one metric across 3 webinars.
          </li>
          <li>
            <strong>Channel Mix</strong> &mdash; latest-webinar pie chart
            of Meta / ManyChat / Setter / Other-organic + a 3-webinar
            trend table.
          </li>
          <li>
            <strong>Meta Campaigns &mdash; Promo Window</strong> &mdash;
            per-campaign Spend / Impressions / Link Clicks / CPL / CTR /
            CVR / Frequency. Red dot on Frequency &gt; 5 = saturation
            risk.
          </li>
          <li>
            <strong>Reactivation Funnel</strong> &mdash; no-show pool size,
            attended, booked. Only meaningful when a reactivation push
            was run that week.
          </li>
          <li>
            <strong>Context banner</strong> at the top is admin-editable
            (or auto-filled by Claude during AI generation). Use it to
            flag structural changes &mdash; pool size shifts, ad-spend
            anomalies, external events.
          </li>
        </ul>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">06</span>
          <h2 className="sop-h2">Tab 3 &middot; Last Week&rsquo;s Sales (Monday only)</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> The per-person deep dive lives here so the
          Overview tab can stay terse. Only Monday recaps include it
          &mdash; on Thursday the cycle isn&rsquo;t closed yet.
        </p>
        <ul>
          <li>
            <strong>Funnel + Money + Funnel Rates + Dollar Yield</strong>
            &mdash; the prior-week version of Section C, plus the cash
            cards.
          </li>
          <li>
            <strong>Week-over-Week Comparison</strong> &mdash; every
            funnel metric with absolute and % delta vs the week before.
            Sign-aware coloring (green up, red down) per metric polarity.
          </li>
          <li>
            <strong>Closer Performance &mdash; Overall</strong> &mdash;
            15-column table grouped by <code>closer_owner</code>. Read
            this top-to-bottom on Monday to spot a closer trending up or
            down.
          </li>
          <li>
            <strong>Setter Performance &mdash; Overall</strong> + <strong>by Booking Mode</strong>
            &mdash; same metric set grouped by <code>setter_owner</code>;
            the by-mode table splits each setter into Setter / Webinar
            rows plus a combined &ldquo;✓ Bonus&rdquo; flag when combined
            SR &ge; 80% AND combined Pros (SQ) &ge; 20.
          </li>
          <li>
            <strong>Booking Mode Split</strong> &mdash; 3 rows: Webinar
            Booked / Setter Booked / Other. Tells you which acquisition
            mode is doing the heavy lifting this week.
          </li>
        </ul>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">07</span>
          <h2 className="sop-h2">Tab 4 &middot; AI Strategic Insights</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> Claude reads the entire data payload and
          surfaces the 8&ndash;12 most important observations &mdash;
          structural changes, wins, watches, flags, fixes in motion, and
          forward signals.
        </p>
        <ul>
          <li>
            Cards are typed (<code>ctx / win / watch / flag / fix / fwd</code>)
            and color-coded. Each card cites specific numbers from the
            payload.
          </li>
          <li>
            <strong>Regenerate</strong> (admin) discards the existing
            cards and re-runs Claude on the same snapshot. Useful after
            the BQ data has been re-loaded or a metric formula changes.
          </li>
          <li>
            Cards are <strong>editable</strong> by admins &mdash; the AI
            output is a starting point, not the final read. Edits persist
            across reloads.
          </li>
          <li>
            The generation pipeline is hybrid &mdash; Haiku first, falls
            back to Sonnet on failure. Status flows{" "}
            <code>pending &rarr; generating &rarr; succeeded</code>. The
            page auto-polls every 5 seconds while in flight.
          </li>
        </ul>
        <p className="sop-callout">
          <strong>If it stays in &ldquo;Queued&rdquo; for &gt; 3 min:</strong>{" "}
          the VM may have crashed. SSH into{" "}
          <code>weekly-insights-vm</code> (us-central1-a) and check{" "}
          <code>~/data_audit/logs/weekly_insights.log</code>. A row stuck
          in <code>generating</code> for &gt; 10 min auto-resets to{" "}
          <code>pending</code> via the timeout self-heal.
        </p>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">08</span>
          <h2 className="sop-h2">Marketing & Sales Solutions tabs</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> Two designated humans &mdash; Alvaro for
          Marketing, Ben for Sales &mdash; post solutions in response to
          each week&rsquo;s flags. Their posts are first-class content,
          not buried comments.
        </p>
        <ul>
          <li>
            Each tab is a free-form editor scoped to the editor&rsquo;s
            email. Only the designated editor (or an admin) can post.
          </li>
          <li>
            Posts persist across snapshots &mdash; the tab is keyed by{" "}
            <code>report_week</code>, so editing a future snapshot
            doesn&rsquo;t change the past.
          </li>
          <li>
            Both tabs render on Monday <em>and</em> Thursday reports.
            (This was a deliberate decision after the v2 refactor briefly
            removed them &mdash; never drop them again.)
          </li>
        </ul>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">09</span>
          <h2 className="sop-h2">Dev Mode &mdash; see the exact SQL</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> When a number looks wrong, the fastest way
          to verify it is to run the same query in BigQuery and inspect
          the rows.
        </p>
        <ol>
          <li>
            In the snapshot header, click <strong>Dev</strong> (admin
            only). This flips the <code>nmm-dev-mode</code> cookie shared
            across Webinar / Setter / Sales / High-Level dashboards.
          </li>
          <li>
            A small blue <code>(i)</code> button now appears next to
            every KPI label and section heading. Click it to open the
            resolved SQL &mdash; <code>@start</code> / <code>@end</code>{" "}
            already substituted to literal dates for this report&rsquo;s
            window.
          </li>
          <li>
            In the modal: <strong>Copy SQL</strong> drops it onto your
            clipboard; <strong>Open in BigQuery</strong> deep-links to
            the console with the query pre-loaded.
          </li>
          <li>
            <strong>↓ Download all SQL</strong> in the header dumps every
            Tab 1 + Tab 2 + Tab 3 query for this window into one{" "}
            <code>.sql</code> file.
          </li>
        </ol>
        <p className="sop-callout">
          The SQL constants and the running fetchers point at the same
          string &mdash; what you see in Dev Mode is bit-for-bit what the
          server ran.
        </p>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">10</span>
          <h2 className="sop-h2">When numbers look wrong</h2>
        </div>
        <ul>
          <li>
            <strong>Stale data:</strong> snapshots are captured at
            create-time. If BQ was re-loaded after the snapshot, click{" "}
            <strong>Regenerate</strong> to refresh the AI insights.
            Funnel + KPI numbers refresh on every page load (revalidate=0).
          </li>
          <li>
            <strong>Card with N/A:</strong> the source mart hasn&rsquo;t
            ingested that field yet (% Tier 1 Leads, CPL Blended). Open
            items are tracked in <code>weekly_report_metrics_sql_reference.md</code>.
          </li>
          <li>
            <strong>Setter-by-Mode TTB column shows &mdash;:</strong>{" "}
            cold-setter prospect with no GHL match. Expected; only
            warm/registered prospects get a time-to-book number.
          </li>
          <li>
            <strong>Latest webinar shows &mdash;:</strong> the snapshot
            was created without auto-populating the latest webinar
            string. Open the row in BQ and patch the{" "}
            <code>latest_webinar</code> column, or just delete + re-create.
          </li>
        </ul>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">11</span>
          <h2 className="sop-h2">Related SOPs</h2>
        </div>
        <ul>
          <li>
            <Link className="sop-link" href="/sops/high-level-dashboard">
              High-Level (CEO) dashboard
            </Link>{" "}
            &mdash; the broader rollup the weekly report aggregates from.
          </li>
          <li>
            <Link className="sop-link" href="/sops/sales-performance-dashboard">
              Sales (Closer) Performance dashboard
            </Link>{" "}
            &mdash; the per-call detail behind the weekly closer rollup.
          </li>
          <li>
            <Link className="sop-link" href="/sops/setter-performance-dashboard">
              Setter Performance dashboard
            </Link>{" "}
            &mdash; per-setter detail behind the weekly setter rollup.
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
