**Audience:** CEO · Leadership

The CEO dashboard is the daily marketing-plus-sales-plus-cycle rollup. One page, one source of truth (`dbt_tuddin.mart_high_level_daily`), no per-cycle drill-downs — built for a sub-10-second scan before standup.

## 01 — What it answers

> **Why:** Before drilling into the per-call, per-webinar dashboards, you want the headline read.

- How much cash + TCV did we bring in over the selected period?
- What did we spend to acquire it (ROAS Cash / ROAS Revenue)?
- How is the booking funnel trending (book → show → close)?
- Are sales cycles getting faster or slower (OCC / FUC days)?

## 02 — The period filter

> **Why:** Everything below the filter is scoped to the chosen window. The default `30d` answers "how's the month going".

- **Period chips:** 7d / 30d / 90d / YTD / custom. Selecting a chip auto-suggests a granularity for the trend chart (day for 7d·30d, week for 90d, month for YTD).
- **Granularity override:** the `?gran=` URL param lets you force day / week / month / year on any period.
- **Date freshness:** top-right pill shows the most recent `dbt_updated_at` — if it's > 24h old, the dbt sync may be failing.

## 03 — Hero KPIs (top 4 cards)

- **Total Ad Spend** — sum of `total_ad_spend` across all Meta campaigns in the window.
- **Total Cash Collected** — Fanbasis + Whop, upfront at close.
- **Total Revenue (TCV)** — total contracted value, regardless of how it's paid.
- **Total Deals Closed** — deal count.

## 04 — Trend chart + secondary KPIs

The line chart plots Cash / TCV / Ad Spend over time at the chosen granularity. Below it: ROAS Cash, ROAS Revenue, Cost per Booked Call, AOV, ACV, PIF Rate, Cash Collection Rate — plus median OCC and FUC days from the sales-cycles rollup.

> 💡 **Reading tip:** a flat or declining ROAS Cash line with rising Ad Spend = a likely flag for next week's Monday report. Cross-check with the Weekly Report once it drops.

## 05 — Dev Mode — see the SQL

> **Why:** Validate a number before escalating.

Click the **Dev** toggle in the header (admin only). The `(i)` badges appear next to every KPI label. Hover/click to see the formula and source column — shared cookie with the other dashboards.

## 06 — When numbers look wrong

- **Today's row is missing:** dbt sync hasn't run yet for today. Wait until ~6 AM ET; the mart updates daily, not intraday.
- **Ad spend looks too low:** Meta API can lag by up to 24h on conversions. Recent rows often revise upward the following day.
- **Cash & TCV swing in opposite directions:** payment-plan deals weight TCV but not cash. Cross-check PIF Rate — a low PIF rate explains a Cash << TCV gap.
- **Stale data freshness pill:** ping ops in `#data` — dbt scheduled run probably failed.

## 07 — Related SOPs

- **Weekly Report dashboard** — the Mon/Thu retro built off the same numbers.
- **Sales (Closer) Performance dashboard** — per-call detail when CEO needs to drill in.
- **Webinar Performance dashboard** — per-webinar breakdown of registration → attendance → close.

---

*Spot a bug or have a feature ask? Open a PR or issue on no-more-mondays-apps.*
