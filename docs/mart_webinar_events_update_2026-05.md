# `mart_webinar_events` schema update — May 2026

> **For the agent updating the Webinar Performance dashboard.** The upstream dbt mart
> (`no-more-mondays-analytics.dbt_tuddin.mart_webinar_events`) changed as part of the
> leadership "metric definition & attribution" sprint. This doc lists exactly what changed
> so the dashboard's queries, types, KPIs/scorecards, charts and table can be updated to match.
>
> Source PR: `artiverse-ai/no-more-mondays-analytics#42`. Authoritative column spec lives in that
> repo at `docs/mart_webinar_events_spec.md` and `NMM_ANALYSIS_CONTEXT.md` (§8.1).

The mart is still **1 row per webinar event** (Sunday / Wednesday / Monthly Workshop), 3 data eras
(`legacy`, `core_old_ads`, `core_new_ads`). It now has **57 columns** (was ~53).

---

## 1. Column changes (the important part)

### Renamed

| Old column | New column | Notes |
|---|---|---|
| `ad_spend` | `total_webinar_ad_spend` | Same meaning + value scope (all "webinar" Meta campaigns, registration + Hammer-Them) **except** the Sunday-day spend is now split 50/50 — see §2. So historical values for Sunday & Wednesday rows shifted slightly. |
| `meta_clicks` | `meta_link_clicks` | Now Meta **link clicks** (`inline_link_clicks`), not all clicks. Registration campaigns only. 50/50 Sunday split applied (so it can be fractional on split rows). |

### New columns

| Column | Type | Meaning |
|---|---|---|
| `webinar_reg_ad_spend` | FLOAT64 | Webinar **registration** campaigns only (= `total_webinar_ad_spend − webinar_hammer_them_ad_spend`). |
| `webinar_hammer_them_ad_spend` | FLOAT64 | Show-up retargeting ("Hammer Them") **webinar** campaigns only. (The book-a-call "Hammer Them" campaign has no "webinar" in its name and is excluded entirely — not in any of these three numbers.) |
| `frequency_webinar_hammer_them` | FLOAT64 (often NULL) | Meta frequency for the Hammer-Them webinar campaign(s) over the attribution window. **Approximate** — `SUM(impressions) / MAX(daily reach)`; slightly overstates. NULL when no reach data and for legacy rows. |
| `cash_collected_per_attendee` | FLOAT64 | `cash_collected / unique_attendees`. |
| `contract_value_per_attendee` | FLOAT64 | `revenue_generated / unique_attendees`. |

Invariant (also enforced by a dbt test): `total_webinar_ad_spend = webinar_reg_ad_spend + webinar_hammer_them_ad_spend`.

### Removed

| Column | Replacement |
|---|---|
| `blended_cpr` | Gone. (The legacy view `mart_funnel_webinar_performance` recomputes its old `cost_per_registration` inline, but the mart itself no longer carries `blended_cpr`.) If you had a "Blended CPR" scorecard, drop it or swap it for `webinar_reg_ad_spend` / `webinar_hammer_them_ad_spend` / `frequency_webinar_hammer_them` / `cash_collected_per_attendee` / `contract_value_per_attendee`. |

### Definition changes (column name unchanged, formula changed)

| Column | Old formula | New formula |
|---|---|---|
| `meta_ctr` | `meta_clicks / meta_impressions` | `meta_link_clicks / meta_impressions` (link CTR; registration campaigns only) |
| `meta_cvr` | `meta_reported_conversions / meta_clicks` | `meta_reported_conversions / meta_link_clicks` |
| `meta_cpl` | `ad_spend / meta_reported_conversions` | `webinar_reg_ad_spend / meta_reported_conversions` |
| `meta_impressions` / `meta_reported_conversions` | all "webinar" campaigns | webinar **registration** campaigns only (Hammer-Them excluded); 50/50 Sunday split |
| `paid_cpr` | `ad_spend / meta_registrants` | `webinar_reg_ad_spend / meta_registrants` (registration spend only) |
| `blended_cpa` | `ad_spend / unique_attendees` | `total_webinar_ad_spend / unique_attendees` (value unchanged by the rename) |
| `blended_cpbc` | `ad_spend / calls_booked` | `total_webinar_ad_spend / calls_booked` |
| `blended_cost_per_held_call` | `ad_spend / calls_held` | `total_webinar_ad_spend / calls_held` |
| `cac` | `ad_spend / deals_closed` | `total_webinar_ad_spend / deals_closed` |
| `roas_cash` | `cash_collected / ad_spend` | `cash_collected / total_webinar_ad_spend` |
| `roas_revenue` | `revenue_generated / ad_spend` | `revenue_generated / total_webinar_ad_spend` |
| `reg_to_attend_rate` | `unique_attendees / total_form_submissions` | `unique_attendees / total_registrants` (legacy rows fall back to `lp_opt_ins`) |
| `reg_to_book_rate` | `calls_booked / total_form_submissions` | `calls_booked / total_registrants` (legacy rows: `lp_opt_ins`) |

### Unchanged (just noting, since they reference ad spend conceptually)

`lp_form_submissions`, `total_registrants`, `meta_registrants`, `tiktok_registrants`, `manychat_registrants`,
`setter_registrants`, `other_organic_registrants`, `unique_attendees`, `pitched_attendees`, `attend_to_pitched_rate`,
`reactivation_*`, `calls_booked`, `calls_booked_active` (already excludes test bookings & dedupes by email),
`calls_held`, `webinar_deposits`, `deals_closed`, `cash_collected`, `deposit_collected`, `revenue_generated`,
`revenue_predicted`, `pitch_to_book_rate`, `spend_account_era`, `zoom_session_uuid`, `dbt_updated_at`,
identity columns (`webinar_date`, `webinar_day`, `booking_week_sun`, `week_start`, `data_era`, `is_legacy`),
`lp_page_views`, `lp_opt_ins`, `lp_opt_in_rate`.

---

## 2. Ad-spend attribution window changed (50/50 Sunday split)

Old: Sunday webinar got all of Thu–Sun; Wednesday webinar got all of Mon–Wed (no overlap).

New: the **Sunday day's spend is split 50/50** between that Sunday's webinar and the following Wednesday's webinar:
- **Sunday webinar** = Thu + Fri + Sat + ½·Sun. *(When there's no Wednesday webinar that week, it keeps the full Sunday + the prior Mon–Wed, as before.)*
- **Wednesday webinar** = ½·Sun + Mon + Tue + Wed.

This applies to `total_webinar_ad_spend`, `webinar_reg_ad_spend`, `webinar_hammer_them_ad_spend`, and the Meta funnel
metrics (`meta_impressions` / `meta_link_clicks` / `meta_reported_conversions`). So those columns can be **fractional**
on split rows (e.g. `meta_impressions = 100675.5`) — that's expected attribution math, not a bug.

(The per-day campaign drill-through table `stg_meta_ad_performance_daily` does **not** apply the split — it attributes the
whole Sunday day to the Sunday webinar. If the dashboard ever uses that table for campaign-level drill-through, roll-ups
there will differ slightly from the mart on weeks with both a Sunday and a Wednesday webinar.)

---

## 3. Files in this repo to update

- **`lib/webinar.ts`**
  - `WebinarEvent` type: rename `ad_spend → total_webinar_ad_spend`, `meta_clicks → meta_link_clicks`; remove `blended_cpr`; add `webinar_reg_ad_spend`, `webinar_hammer_them_ad_spend`, `frequency_webinar_hammer_them`, `cash_collected_per_attendee`, `contract_value_per_attendee`.
  - `toWebinarEvent()`: same — map the new/renamed columns from `row`. (Query is `SELECT *` so it already returns everything; just the field mapping needs it.)
  - `computeKpis()`: `r.ad_spend` → `r.total_webinar_ad_spend`. Decide whether the headline "spend" KPI should be total or registration spend — recommend keeping it `total_webinar_ad_spend` for the headline, and consider adding a separate "Hammer Them spend" tile.
- **`components/webinar/HeadlineKPIs.tsx`** (and `app/dashboards/webinar/page.tsx`) — wherever a "Spend" / "Blended CPR" / "Meta Clicks" KPI is shown. Drop "Blended CPR". Suggested new tiles: **Reg ad spend**, **Hammer Them spend**, **Hammer Them frequency**, **Link clicks** (rename of Clicks), **Cash / attendee**, **Contract value / attendee**. `paid_cpr` is now the only paid-acquisition cost tile (it's registration spend ÷ Meta registrants).
- **`components/webinar/SpendCashChart.tsx`** — references `ad_spend`; rename to `total_webinar_ad_spend`. Optionally stack `webinar_reg_ad_spend` + `webinar_hammer_them_ad_spend`.
- **`components/webinar/RoasChart.tsx`**, **`DealsChart.tsx`** — RoasChart uses `roas_cash` / `roas_revenue` (unchanged columns, values shifted slightly with the new attribution).
- **`components/webinar/WebinarTable.tsx`** — references `ad_spend` (and possibly `meta_clicks`, `blended_cpr`); rename / drop / add columns.
- **`components/webinar/format.ts`** — if there's per-column formatting/labelling, add entries for the new columns; relabel "Ad Spend" → "Total Webinar Ad Spend" (or "Webinar Ad Spend") and "Meta Clicks" → "Meta Link Clicks".
- **`app/dashboards/webinar/[date]/page.tsx`** — the per-webinar drill-through references `ad_spend` (and likely `blended_cpr`). Update the Marketing section to show the 4 ad-spend columns + the 2 per-attendee columns; drop Blended CPR.
- The **`raw`** JSON viewer on the detail page automatically picks up all new columns (it iterates `Object.entries(row)`), so no change needed there beyond the rename of any explicitly-named fields.

Quick grep to find every reference: `grep -rn 'ad_spend\|meta_clicks\|blended_cpr' app components lib`.

---

## 4. Naming convention reminder (for tooltips / "i" boxes)

- `paid_*` = Meta **registration** ad spend vs Meta-acquired registrants only (truly paid).
- `blended_*` = `total_webinar_ad_spend` vs the whole funnel (organic, ManyChat, setter-sent, reactivations all in the denominator).
- Plain conversion rates (no spend involved) have no prefix.
- `webinar_reg_ad_spend` + `webinar_hammer_them_ad_spend` = `total_webinar_ad_spend`. The "Hammer Them" here is the **webinar** show-up retargeting campaign — distinct from the book-a-call "Hammer Them" campaign (which is out of scope for this mart).

---

## 5. Out of scope (don't build yet)

- The **high-level / CEO dashboard** ("total-total" ad spend, all-funnels calls booked & cash collected, ROAS on TCC/TCV, plus sales-side Show Rate / Close Rate / AOV / ACV / Sales Cycle / PIF Rate) — separate build, pending its own plan.
- Sales-side metric changes (show/close rate denominators, "setter-qualified vs closer-qualified calls held", sales-cycle medians) — pending the sales-metrics deep-dive. `int_calls_enriched` is unchanged for now.
