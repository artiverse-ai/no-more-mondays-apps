**Audience:** Leadership · Marketing · Sales

The weekly report is the single source of truth for "how did the business do this week?". Two formats land each week: a Monday recap of the prior Sun–Sat, and a Thursday midweek check on the in-flight Sun–Wed window. Each report is a dated snapshot — once created it never re-runs the metrics, so what leadership reads on a Monday is exactly what was true when the snapshot was captured.

## 01 — Two report formats

> **Why:** The two reports answer different questions, so the layouts are deliberately different.

- **Monday recap (6 tabs)** — full retro on the prior Sun–Sat. Tabs: Overview / Latest Webinar / Last Week's Sales / AI Strategic Insights / Marketing Solutions / Sales Solutions. The "Last Week's Sales" tab is the deep dive — per-closer, per-setter, by booking mode, with week-over-week deltas.
- **Thursday midweek check (5 tabs)** — same KPI strip + Overview, but the "Last Week's Sales" tab is removed because the Wednesday cycle's sales haven't landed yet. The latest-webinar column shows partial cycle data with a `partial` tag.

> 💡 **Solutions tabs (Marketing + Sales)** are preserved on *both* formats. Alvaro and Ben can edit them independently of the AI insights.

## 02 — Creating a snapshot

> **Why:** Snapshots are admin-created on demand. There's no auto-run cron — you decide which Mon/Thu gets a report.

1. On `/dashboards/weekly-report`, click **+ Create snapshot** (admin-only).
2. Pick any past Monday or Thursday from the dropdown (last 12 weeks). Future dates are not selectable. Existing snapshots show as "already exists — Open"; missing-data windows disable the Create button with a hover tooltip explaining what BQ table is empty.
3. Click **Create snapshot**. The row goes into `pending` status. Within ~60 seconds the insights-generator VM picks it up, runs Claude on the live BQ data, and writes 8–12 insight cards plus the context banners.
4. The page auto-polls every 5 seconds. When status flips to `succeeded`, the cards render.

> 💡 **Clicking a row anywhere** opens it. The Delete button stops propagation so it never navigates by accident.

## 03 — The persistent KPI strip

Five metrics live at the top of every tab so you never lose the headline read.

- **Avg Webinar Show Rate** — weighted Zoom attend rate across Sun + Wed webinars in the window. Target 24%.
- **% Tier 1 Leads** — placeholder; mart fields land later this quarter.
- **Blended Cash ROAS** — Fanbasis cash / total Meta ad spend. Target 4×.
- **CPL Blended** — placeholder; denominator is the open item (#11.2 in the spec).
- **Cash / Booked Call (DPC)** — Sergio's KPI. Fanbasis cash / total Calendly bookings.

## 04 — Tab 1 · Overview

> **Why:** Headline money + funnel state, one screen. Read top-to-bottom on Monday morning.

- **Section A · Money + Cycle** — Cash Collected, Revenue (TCV), ROAS (Cash / TCV), Ad Spend, Deals, AOV, ACV, PIF Rate, Cash Collection Rate, OCC/FUC median+average book-to-close time.
- **Section B · Marketing Efficiency** — Total Calls Booked (with Active sub-line), Cost/Booked Call, Cash/Booked Call, Avg Webinar Show Rate, CPL Blended.
- **Section C · Sales Funnel** — 5 stages (Prospects → Prospects-SQ → Shows → Qualified Shows → Deals), plus 5 funnel rates (Show Rate, Close Rate Shows, Close Rate CQ, Setter DQ Rate, Closer DQ Rate), plus 6 prospect-efficiency cards.

Every label has a hover tooltip with the exact formula and BQ source. Hover anywhere on the metric name — no click needed.

## 05 — Tab 2 · Latest Webinar

One vertical column per webinar (latest 3) so you can spot week-over-week shifts at a glance.

- **Top-of-Funnel Comparison** — Registration / Attendance / Meta Funnel / Cost Efficiency / Sales sub-sections, each row is one metric across 3 webinars.
- **Channel Mix** — latest-webinar pie chart of Meta / ManyChat / Setter / Other-organic + a 3-webinar trend table.
- **Meta Campaigns — Promo Window** — per-campaign Spend / Impressions / Link Clicks / CPL / CTR / CVR / Frequency. Red dot on Frequency > 5 = saturation risk.
- **Reactivation Funnel** — no-show pool size, attended, booked. Only meaningful when a reactivation push was run that week.
- **Context banner** at the top is admin-editable (or auto-filled by Claude during AI generation). Use it to flag structural changes — pool size shifts, ad-spend anomalies, external events.

## 06 — Tab 3 · Last Week's Sales (Monday only)

The per-person deep dive lives here so the Overview tab can stay terse. Only Monday recaps include it — on Thursday the cycle isn't closed yet.

- **Funnel + Money + Funnel Rates + Dollar Yield** — the prior-week version of Section C, plus the cash cards.
- **Week-over-Week Comparison** — every funnel metric with absolute and % delta vs the week before. Sign-aware coloring (green up, red down) per metric polarity.
- **Closer Performance — Overall** — 15-column table grouped by `closer_owner`. Read this top-to-bottom on Monday to spot a closer trending up or down.
- **Setter Performance — Overall** + **by Booking Mode** — same metric set grouped by `setter_owner`; the by-mode table splits each setter into Setter / Webinar rows plus a combined "✓ Bonus" flag when combined SR ≥ 80% AND combined Pros (SQ) ≥ 20.
- **Booking Mode Split** — 3 rows: Webinar Booked / Setter Booked / Other. Tells you which acquisition mode is doing the heavy lifting this week.

## 07 — Tab 4 · AI Strategic Insights

Claude reads the entire data payload and surfaces the 8–12 most important observations — structural changes, wins, watches, flags, fixes in motion, and forward signals.

- Cards are typed (`ctx / win / watch / flag / fix / fwd`) and color-coded. Each card cites specific numbers from the payload.
- **Regenerate** (admin) discards the existing cards and re-runs Claude on the same snapshot. Useful after the BQ data has been re-loaded or a metric formula changes.
- Cards are **editable** by admins — the AI output is a starting point, not the final read. Edits persist across reloads.
- The generation pipeline is hybrid — Haiku first, falls back to Sonnet on failure. Status flows `pending → generating → succeeded`. The page auto-polls every 5 seconds while in flight.

> 💡 **If it stays in "Queued" for > 3 min:** the VM may have crashed. SSH into `weekly-insights-vm` (us-central1-a) and check `~/data_audit/logs/weekly_insights.log`. A row stuck in `generating` for > 10 min auto-resets to `pending` via the timeout self-heal.

## 08 — Marketing & Sales Solutions tabs

Two designated humans — Alvaro for Marketing, Ben for Sales — post solutions in response to each week's flags. Their posts are first-class content, not buried comments.

- Each tab is a free-form editor scoped to the editor's email. Only the designated editor (or an admin) can post.
- Posts persist across snapshots — the tab is keyed by `report_week`, so editing a future snapshot doesn't change the past.
- Both tabs render on Monday *and* Thursday reports. (This was a deliberate decision after the v2 refactor briefly removed them — never drop them again.)

## 09 — Dev Mode — see the exact SQL

> **Why:** When a number looks wrong, the fastest way to verify it is to run the same query in BigQuery and inspect the rows.

1. In the snapshot header, click **Dev** (admin only). This flips the `nmm-dev-mode` cookie shared across Webinar / Setter / Sales / High-Level dashboards.
2. A small blue `(i)` button now appears next to every KPI label and section heading. Click it to open the resolved SQL — `@start` / `@end` already substituted to literal dates for this report's window.
3. In the modal: **Copy SQL** drops it onto your clipboard; **Open in BigQuery** deep-links to the console with the query pre-loaded.
4. **↓ Download all SQL** in the header dumps every Tab 1 + Tab 2 + Tab 3 query for this window into one `.sql` file.

> 💡 The SQL constants and the running fetchers point at the same string — what you see in Dev Mode is bit-for-bit what the server ran.

## 10 — When numbers look wrong

- **Stale data:** snapshots are captured at create-time. If BQ was re-loaded after the snapshot, click **Regenerate** to refresh the AI insights. Funnel + KPI numbers refresh on every page load (revalidate=0).
- **Card with N/A:** the source mart hasn't ingested that field yet (% Tier 1 Leads, CPL Blended). Open items are tracked in `weekly_report_metrics_sql_reference.md`.
- **Setter-by-Mode TTB column shows —:** cold-setter prospect with no GHL match. Expected; only warm/registered prospects get a time-to-book number.
- **Latest webinar shows —:** the snapshot was created without auto-populating the latest webinar string. Open the row in BQ and patch the `latest_webinar` column, or just delete + re-create.

## 11 — Related SOPs

- **High-Level (CEO) dashboard** — the broader rollup the weekly report aggregates from.
- **Sales (Closer) Performance dashboard** — the per-call detail behind the weekly closer rollup.
- **Setter Performance dashboard** — per-setter detail behind the weekly setter rollup.

---

*Spot a bug or have a feature ask? Open a PR or issue on no-more-mondays-apps.*
