**Audience:** Sales managers · CEO

Every call that hit a closer's calendar, rolled up by closer with cross-filters for source / setter / outcome / OCC·FUC. Lives on `dbt_tuddin.int_calls_enriched` with the PR-#43 show-rate fix. Cross-filter chips never shrink as you select — they always show the full option list from unfiltered data.

## 01 — What it answers

- Which closer brought in the most cash this week / month?
- Who has the best show rate? Best close rate (Shows vs CQ basis)?
- Are there outliers in OCC vs FUC days that hint at process drift?
- What does the funnel look like when filtered to one setter, one source, one outcome?

## 02 — Period picker + Δ-vs-prior

> **Why:** Every KPI is paired with its equal-length prior-period delta so you don't have to do mental math.

- Default: **This week**. The dashboard automatically queries the equal-length prior window in parallel.
- **Δ pills** next to each KPI show absolute and % change. Sign-aware coloring (green up, red down) per metric polarity.
- **Custom range:** use the date picker. The prior window automatically shifts back by the same number of days.

## 03 — Cross-filters

> **Why:** Cross-filters compose — pick a closer, then a source, then an outcome to surface the exact slice.

- **Source** — Webinar / Setter / Affiliate / Website / Skool / Lead Magnet. Pulls from `final_marketing_flow`.
- **Closer**, **Setter** — assignee chips.
- **Triage / Call Outcome / OCC·FUC** — disposition state and close type.
- **Email search** — partial match against `prospect_email_lc`. Useful for tracing one deal end-to-end.

> 💡 **Filter chips never shrink.** The full option list is derived from *unfiltered* data so you can always un-narrow without scrolling.

## 04 — The funnel + per-closer rollup

- **Funnel counts**: Prospects → Pros (D'd) → Setter DQ / Pros (SQ) → Shows → Qualified Shows → Deals, with prior-period deltas inline.
- **Per-closer rollup table**: 15+ columns. Sort by Cash by default. Click any column header to re-sort.
- **Detail view** (tab toggle): one row per call. Useful when an aggregate looks suspicious — jump to the source rows.

## 05 — Dev Mode — resolved SQL

Admin only. Click **Dev** in the header to toggle. Each KPI grows an `(i)` badge revealing its formula, source column, and any inline-substituted filter values.

## 06 — When numbers look wrong

- **Shows count is too high vs Qualified Shows:** check Closer DQ counts. The PR-#43 fix ensures Setter DQs are excluded from shows, but a Closer DQ still counts as a show.
- **Same closer appears with different cases:** `closer_owner` is normalized in dbt — if you see "Tyler" and "tyler", the normalization rule was bypassed. Ping data ops.
- **Setter DQ Rate looks too high:** remember the denominator is *Pros (D'd)*, not Shows. A closer who only takes pre-qualified leads will show a low rate; the relevant comparison is to the team baseline.
- **Cash and Deals don't match a contract:** payment-plan + deposit logic lives in `is_deal` + `is_paid_in_full`. Use Dev Mode to verify which flag is being summed.

## 07 — Related SOPs

- **Setter Performance dashboard** — same data, setter-perspective.
- **Weekly Report dashboard** — the snapshotted Mon/Thu retro using the same closer rollup.
- **Funnel Search** — trace one Calendly booking through the funnel.

---

*Spot a bug or have a feature ask? Open a PR or issue on no-more-mondays-apps.*
