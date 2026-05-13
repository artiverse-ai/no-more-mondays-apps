# Dashboard updates — May 2026 (consolidated)

> **For the agent updating the dashboards in this repo.** Two analytics-repo PRs landed back-to-back; this doc consolidates everything that has to change in `no-more-mondays-apps` and gives the ready-to-paste prompt at the bottom.
>
> **Source PRs:**
> - artiverse-ai/no-more-mondays-analytics#42 (2026-05-12) — webinar marketing refactor: ad-spend split, link-clicks Meta funnel, per-attendee metrics.
> - artiverse-ai/no-more-mondays-analytics#43 (2026-05-13) — sales-side fixes + webinar shows bug fix + NEW `mart_high_level_daily` (CEO).
>
> **Reference docs in the analytics repo:** `docs/mart_webinar_events_spec.md`, `docs/mart_high_level_daily_spec.md`, `docs/looker_studio_change_list_2026-05.md`, `NMM_ANALYSIS_CONTEXT.md` (full snapshot mirrored at `docs/NMM_ANALYSIS_CONTEXT.md` in this repo).
>
> Earlier hand-off note (still accurate for the webinar marketing piece): `docs/mart_webinar_events_update_2026-05.md`.

---

## 1. Three pieces of work

### A. Webinar Performance dashboard — finish the May-12 refactor + add the May-13 sales-side changes

#### From PR #42 (May 12) — webinar marketing
- `lib/webinar.ts` `WebinarEvent` type + `toWebinarEvent` mapper: rename `ad_spend` → `total_webinar_ad_spend`, `meta_clicks` → `meta_link_clicks`; **remove `blended_cpr`**; add `webinar_reg_ad_spend`, `webinar_hammer_them_ad_spend`, `frequency_webinar_hammer_them`, `cash_collected_per_attendee`, `contract_value_per_attendee`. Update `computeKpis` (`r.ad_spend → r.total_webinar_ad_spend`).
- Components: rename labels "Ad Spend" → "Total Webinar Ad Spend", "Meta Clicks" → "Meta Link Clicks"; drop the **Blended CPR** tile; add tiles for **Reg Ad Spend**, **Hammer Them Ad Spend**, **Hammer Them Frequency**, **Cash / Attendee**, **Contract Value / Attendee**. `paid_cpr` is the only paid-acquisition cost tile.
- Note Meta-funnel columns can be **fractional** on weeks where the Sunday day is split 50/50 between that Sunday's webinar and the following Wednesday's webinar (`meta_impressions = 100675.5` etc.) — don't `Math.round()` on display.

#### From PR #43 (May 13) — sales-side downstream changes
- `lib/webinar.ts` `WebinarEvent` type: rename `calls_held` → `shows`; rename `blended_cost_per_held_call` → `blended_cost_per_show`; add `qualified_shows`, `blended_cost_per_qualified_show`, `blended_cpbc_active`, `roas_cash_running` (Live ROAS).
- Components: rename "Calls Held" → "Shows" everywhere. Add tiles for **Qualified Shows**, **Cost Per Qualified Show**, **Cost Per Active Booked Call**, **Live ROAS** (`roas_cash_running`).
- **Bug-fix shift:** historical `shows` values are *smaller* than the old `calls_held` for any webinar that had Setter DQ rows (the prior `calls_held` falsely included them). Example: 2026-04-19 Wednesday went `calls_held=16` → `shows=9`. Don't panic — it's a fix.
- Live ROAS will be `null` for legacy rows (Fanbasis coverage starts mid-2025). Display "—" gracefully.

Files to touch:
- `lib/webinar.ts` (type + mapper + `computeKpis`)
- `components/webinar/HeadlineKPIs.tsx`, `SpendCashChart.tsx`, `RoasChart.tsx`, `DealsChart.tsx`, `WebinarTable.tsx`, `format.ts`
- `app/dashboards/webinar/page.tsx`, `app/dashboards/webinar/[date]/page.tsx`
- Sweep: `grep -rn 'ad_spend\|meta_clicks\|blended_cpr\|calls_held\|blended_cost_per_held_call' app components lib`

### B. **NEW** — High-Level / CEO Dashboard

Build a brand-new dashboard at `app/dashboards/high-level/page.tsx` over the new `mart_high_level_daily` mart + `int_calls_enriched` (for sales-cycle medians).

#### `mart_high_level_daily` — full mart spec
**Source:** `no-more-mondays-analytics.dbt_tuddin.mart_high_level_daily`. **Grain:** 1 row per `metric_date` (DATE), zero-filled across `GENERATE_DATE_ARRAY('2025-05-01', today)`. The mart stores **daily counts + sums** + **rate numerators and denominators**. The dashboard sums any date range and computes rates from the summed counts.

**Dual date-key:** marketing-side (cash, revenue, deals, PIF) on `date_closed`; funnel-stage (dispositioned, shows, DQ counts) on `appointment_date_time::date`.

Columns:

| Column | Type | Notes |
|---|---|---|
| `metric_date` | DATE | Primary key. Zero-filled. |
| `total_ad_spend` | FLOAT64 | **All** Meta campaigns that day (every category) — NOT just webinar. |
| `total_calls_booked` | INT64 | Strategy-call Calendly bookings created that day. Sales calls only. |
| `total_calls_booked_active` | INT64 | Same with `is_canceled = FALSE` (dynamic). |
| `total_cash_collected` | FLOAT64 | Cash on deals closed that day (upfront only). |
| `total_revenue_contracted` | FLOAT64 | TCV of deals closed that day. |
| `total_deals_closed` | INT64 | Distinct deal-prospects closing that day. |
| `count_prospects_dispositioned` | INT64 | Show/close rate denominators (key on appointment date). |
| `count_show_rate_eligible` | INT64 |  |
| `count_show_ups` | INT64 |  |
| `count_close_rate_eligible` | INT64 |  |
| `count_deals_attended` | INT64 | `is_deal AND is_show_up` — close-rate numerator. |
| `count_pif_deals` | INT64 | Paid-in-full deals (by `date_closed`). |
| `count_setter_dq` | INT64 |  |
| `count_closer_dq` | INT64 |  |
| `dbt_updated_at` | TIMESTAMP |  |

#### CEO dashboard — exact KPI formulas (Looker-style; compute from summed counts in JS)

**Marketing tiles (top row):**
| Tile | Formula |
|---|---|
| Total Ad Spend | `SUM(total_ad_spend)` |
| Total Calls Booked | `SUM(total_calls_booked)` |
| Total Cash Collected | `SUM(total_cash_collected)` |
| Total Revenue Contracted (TCV) | `SUM(total_revenue_contracted)` |
| Cost Per Booked Call | `SUM(total_ad_spend) / SUM(total_calls_booked)` |
| Cash Per Booked Call (DPC) | `SUM(total_cash_collected) / SUM(total_calls_booked)` |
| ROAS (TCC) | `SUM(total_cash_collected) / SUM(total_ad_spend)` |
| ROAS (TCV) | `SUM(total_revenue_contracted) / SUM(total_ad_spend)` |

**Sales tiles (middle row):**
| Tile | Formula |
|---|---|
| Show Rate | `SUM(count_show_ups) / SUM(count_show_rate_eligible)` |
| Close Rate (on shows) | `SUM(count_deals_attended) / SUM(count_show_ups)` |
| Close Rate (closer-qualified) | `SUM(count_deals_attended) / SUM(count_close_rate_eligible)` |
| Setter DQ Rate | `SUM(count_setter_dq) / SUM(count_prospects_dispositioned)` |
| Closer DQ Rate | `SUM(count_closer_dq) / SUM(count_show_ups)` |
| AOV | `SUM(total_cash_collected) / SUM(total_deals_closed)` |
| ACV | `SUM(total_revenue_contracted) / SUM(total_deals_closed)` |
| PIF Rate | `SUM(count_pif_deals) / SUM(total_deals_closed)` |

**Sales-cycle tiles (bottom row — query `int_calls_enriched`, NOT pre-aggregated)**

Filter `int_calls_enriched` by `date_closed` in the selected period, then:
- **Median Booking → Close (OCC):** `MEDIAN(booking_to_close_days) WHERE close_type='OCC'`. ~2 days typical.
- **Median First-Call → Close (FUC):** `MEDIAN(first_call_to_close_days) WHERE close_type='FUC'`. ~21 days typical.

(JS-side: pull the rows, JS-median them.)

**Trend chart (bottom):** daily `total_ad_spend` + `total_cash_collected` stacked over the selected period.

**Period filter (top):** last 7d / 30d / 90d / MTD / QTD / YTD / custom. Default last 30 days.

#### Suggested files
- `lib/highLevel.ts` — `HighLevelDay` type, `getHighLevelRange(from, to)` (queries `mart_high_level_daily`), `getSalesCyclesRange(from, to)` (queries `int_calls_enriched` for the medians), `computeCeoKpis(rows)`.
- `components/highLevel/` — `KpiTile.tsx`, `MarketingKpis.tsx`, `SalesKpis.tsx`, `SalesCycleKpis.tsx`, `DailyTrendChart.tsx`, `PeriodFilter.tsx`.
- `app/dashboards/high-level/page.tsx` — assemble.
- Add nav link from `app/page.tsx` (under Dashboards).

### C. Closer Performance / Sales metrics (if exposed in this repo)

The new `int_calls_enriched` fields (`is_paid_in_full`, `closer_dq_reasons`) and the `'Canceled by Closer'` value remap are immediately usable. If any closer dashboard lives in this repo, surface a **PIF Rate** tile and (once Tyler ships `dq_reason` in Airtable) a **Closer DQ Breakdown** chart. Otherwise, that work is happening in Looker — see `docs/looker_studio_change_list_2026-05.md` in the analytics repo.

---

## 2. Reference architecture refresher

- `int_calls_enriched` is the per-call source of truth. New columns: `is_paid_in_full`, `closer_dq_reasons` (NULL until Tyler ships the Airtable field).
- `mart_webinar_events` is 1 row per webinar. Updated columns per §A above.
- `mart_high_level_daily` is the **new** mart, 1 row per day, designed for the CEO dashboard.
- `mart_funnel_webinar_performance` is a backward-compat view (Sunday + Monthly only) — its consumers are shielded.
- Full context: `docs/NMM_ANALYSIS_CONTEXT.md` (mirrored in this repo).

---

## 3. Bug fix to communicate

The webinar mart's `shows` (renamed from `calls_held`) is now **smaller** than before for any webinar that had Setter DQ rows. The previous value erroneously included Setter DQ via Airtable's broken `is_call_held`. Downstream metrics (`blended_cost_per_show`, ROAS-on-shows, etc.) shift correspondingly. This is a **fix, not a regression** — communicate to anyone watching historical trends in the dashboard.

---

## 4. Ready-to-paste prompt for the dashboard agent

Paste this verbatim into a Claude Code session in `no-more-mondays-apps`:

```
The upstream dbt marts changed across two analytics-repo PRs (#42 webinar marketing
refactor, #43 sales-side + new CEO mart). Read `docs/sales-ceo-dashboard-update-2026-05.md`
in this repo — that's the consolidated hand-off note with every column change, the full
`mart_high_level_daily` spec, and the exact KPI formulas for the new CEO dashboard. The
broader analytics context lives at `docs/NMM_ANALYSIS_CONTEXT.md` (mirror of the source
of truth in the analytics repo).

Three pieces of work to ship:

1. **Update the Webinar Performance dashboard** for BOTH PR #42 and #43 changes:
   - `lib/webinar.ts` `WebinarEvent` type & `toWebinarEvent` mapper:
     - Renames: ad_spend → total_webinar_ad_spend, meta_clicks → meta_link_clicks,
       calls_held → shows, blended_cost_per_held_call → blended_cost_per_show.
     - Remove: blended_cpr.
     - Add: webinar_reg_ad_spend, webinar_hammer_them_ad_spend,
       frequency_webinar_hammer_them, cash_collected_per_attendee,
       contract_value_per_attendee, qualified_shows,
       blended_cost_per_qualified_show, blended_cpbc_active, roas_cash_running.
   - `computeKpis`: r.ad_spend → r.total_webinar_ad_spend.
   - Components (`components/webinar/HeadlineKPIs.tsx`, `SpendCashChart.tsx`,
     `RoasChart.tsx`, `DealsChart.tsx`, `WebinarTable.tsx`, `format.ts`):
     - Rename "Ad Spend"→"Total Webinar Ad Spend", "Meta Clicks"→"Meta Link Clicks",
       "Calls Held"→"Shows", "Cost Per Held Call"→"Cost Per Show".
     - Drop the Blended CPR tile.
     - Add tiles: Reg Ad Spend, Hammer Them Ad Spend, Hammer Them Frequency,
       Cash / Attendee, Contract Value / Attendee, Qualified Shows,
       Cost Per Qualified Show, Cost Per Active Booked Call, Live ROAS.
   - `app/dashboards/webinar/page.tsx` and `[date]/page.tsx` — same renames in any
     inline references.
   - Sweep: `grep -rn 'ad_spend\|meta_clicks\|blended_cpr\|calls_held\|blended_cost_per_held_call' app components lib`
   - Notes:
     - Meta-funnel columns (impressions/link_clicks/conversions) can be FRACTIONAL
       on Sunday-split weeks — don't `Math.round()` them.
     - `roas_cash_running` (Live ROAS) is null for legacy rows — render "—".
     - "shows" historical values are SMALLER than old "calls_held" for any webinar
       that had Setter DQs — bug fix, not a regression. Surface a one-line note in
       the table tooltip / page header so users aren't surprised.

2. **Build a NEW CEO dashboard** at `app/dashboards/high-level/page.tsx`:
   - `lib/highLevel.ts`:
     - `HighLevelDay` type matching mart_high_level_daily columns (see the doc).
     - `getHighLevelRange(from, to)` queries
       `no-more-mondays-analytics.dbt_tuddin.mart_high_level_daily WHERE metric_date BETWEEN @from AND @to`.
     - `getSalesCyclesRange(from, to)` queries
       `no-more-mondays-analytics.dbt_tuddin.int_calls_enriched WHERE is_deal AND date_closed BETWEEN @from AND @to`
       and returns `[{booking_to_close_days, first_call_to_close_days, close_type}]`.
     - `computeCeoKpis(highLevelRows)` returns marketing + sales KPIs using the
       exact formulas in the doc (sum the additive columns; rates = SUM(num)/SUM(denom)).
     - `computeSalesCycleMedians(rows)` — JS median, filtered by close_type.
   - `components/highLevel/`:
     - `KpiTile.tsx` (label + value + optional sub-label).
     - `MarketingKpis.tsx` (8 tiles: Total Ad Spend, Total Calls Booked, Total Cash,
       TCV, Cost Per Booked Call, DPC, ROAS TCC, ROAS TCV).
     - `SalesKpis.tsx` (8 tiles: Show Rate, Close Rate on shows, Close Rate
       closer-qualified, Setter DQ Rate, Closer DQ Rate, AOV, ACV, PIF Rate).
     - `SalesCycleKpis.tsx` (2 tiles: Median Booking→Close OCC, Median 1st-Call→Close FUC).
     - `DailyTrendChart.tsx` (stacked daily Ad Spend + Cash Collected over the period).
     - `PeriodFilter.tsx` (last 7d / 30d / 90d / MTD / QTD / YTD / custom, default 30d).
   - `app/dashboards/high-level/page.tsx` — assemble: filter at top, marketing tiles,
     sales tiles, sales-cycle tiles, trend chart at bottom.
   - Add nav link from `app/page.tsx` under Dashboards.

3. **Verify with `pnpm build`** and (if you can run against BigQuery) `pnpm dev` against
   the new dashboard. Sanity check: total ad spend last 30d ≈ Meta Ads Manager total;
   no broken fields anywhere; the Webinar dashboard renders without the dropped
   Blended CPR / Meta Clicks fields.

Then commit to `main` matching the repo convention (direct-to-main, no PR per recent
history — see `git log --oneline -10`).

Out of scope (don't build / don't touch):
- Sales-cycle MEDIAN vs AVERAGE debate — Sergio brainstorm pending; use MEDIAN.
- Opt-in → close cycle — V2.
- Cost-per-ad-booked-call attribution — V2.
- TCV refund handling — V2.
- Per-day Live ROAS on the CEO dashboard — V1 only has it per-webinar; CEO dashboard
  uses ROAS TCC (= total_cash_collected / total_ad_spend), no payment-plan smoothing.
- `closer_dq_reasons` Closer DQ breakdown — column is NULL until Tyler ships the
  Airtable `dq_reason` field. Stub the tile but don't wire it up yet, OR skip.
```

---

## 5. Out of scope (V2 — for the record)

- Sales-cycle MEDIAN vs AVERAGE — pending Sergio brainstorm.
- Opt-in → close cycle (needs lead-source-date join).
- Cost per ad-booked call attribution.
- TCV refund handling.
- Richer Product-side Airtable join for Live ROAS attribution (V1 sums all-time Fanbasis payments by deal-prospect emails; coverage ~82% in V1).
