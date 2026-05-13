# No More Mondays (NMM) — Analytics Context File

> **Source of truth:** [`artiverse-ai/no-more-mondays-analytics:NMM_ANALYSIS_CONTEXT.md`](https://github.com/artiverse-ai/no-more-mondays-analytics/blob/main/NMM_ANALYSIS_CONTEXT.md). This file is a copy mirrored into the apps repo so dashboard agents can reference it without leaving the repo. If it goes stale, pull the latest from the source.
>
> **Purpose:** Hand this file to any Claude instance with BigQuery MCP access. It contains everything needed to run analysis on this project with zero setup questions. Read it fully before querying.

---

## 1. Infrastructure Overview

| Item | Value |
|---|---|
| **BigQuery project** | `no-more-mondays-analytics` |
| **dbt dataset** | `dbt_tuddin` |
| **dbt tool** | dbt Cloud CLI (routes run/test to dbt Cloud) |
| **dbt project name** | `nomoremondays` |
| **Ingestion** | Fivetran (Calendly, Meta Ads, Zoom, Airtable, Fanbasis), Airbyte (GHL), Google Sheets (funnelsheet, closersheet) |
| **BI layer** | Looker Studio |
| **OS / repo** | Windows, `C:\Users\kashi\no-more-mondays-analytics` |

All dbt models live in `no-more-mondays-analytics.dbt_tuddin.*`. Raw sources live in separate schemas (see Section 3).

---

## 2. Business Context

**No More Mondays** is a high-ticket coaching business. Revenue comes from selling the **Freedom Creator Accelerator** program (~$5–15k price point) via a webinar funnel.

### Webinar Types
Three distinct event types that must never be mixed:

| Type | Schedule | Notes |
|---|---|---|
| **Sunday** | Every Sunday, 12pm ET | Primary weekly webinar |
| **Wednesday** | Every Wednesday, 8pm ET | Second weekly webinar (not all weeks) |
| **Monthly Workshop** | Monthly, on a Sunday | "Monthly Lump Sum Workshop" — separate tracking |

**Rule: Monthly Workshop data is NEVER mixed with Sunday/Wednesday weekly data.**

### Sales Funnel Flow
```
Meta/TikTok Ad → Landing Page → GHL Registration Form
→ Webinar (Zoom) → Attendee books call (Calendly)
→ Closer call (Airtable CRM) → Deal / Deposit / Follow-up
```

---

## 3. Data Eras — Critical for Historical Queries

Three eras exist with different sources for ads and CRM data:

| Era | Date Range | Ad Account | Calls/Deals Source | `data_era` value |
|---|---|---|---|---|
| **Legacy** | Pre-2025-11-23 | `raw_meta_facebook_ads` | `stg_closersheet_metrics_weekly` (weekly aggregates) | `'legacy'` |
| **Core — old ads** | 2025-11-23 – 2026-03-03 | `raw_meta_facebook_ads` | `int_calls_enriched` (Airtable, call-level) | `'core_old_ads'` |
| **Core — new ads** | 2026-03-04 – present | `raw_meta_2_reports` | `int_calls_enriched` (Airtable, call-level) | `'core_new_ads'` |

- Legacy era has only Sunday webinars and weekly-grain metrics (no call-level data)
- Era cutoff for ad accounts: `2026-03-04` (old account was restricted)
- Era cutoff for Airtable CRM: `2025-11-23`

---

## 4. Raw Sources (BigQuery Schemas)

### 4.1 `raw_airtable_nmm___coaching_crm_appyriu7120p0t3kt`
**Note:** Hardcoded directly in `stg_airtable_sales_calls.sql` — not declared in `sources.yml`.

| Table | Description |
|---|---|
| `sales_calls` | One row per scheduled call. All CRM data for closers. Key fields: `id`, `prospect_email`, `closer_owner`, `setter_owner`, `appointment_date_time`, `date_closed`, `call_outcome`, `source` (marketing flow), `f_dispositioned`, `f_not_taken`, `f_ghosted`, `f_canceled`, `f_rescheduled`, `f_closed` (0/1 flags), `cash_collected`, `revenue_generated`, `deposit_` (deposit collected), `revenue_predicted` |

**Important:** One record is created per appointment. Rescheduled calls create a NEW record; the old record is preserved with `f_rescheduled=1`. Records are never updated.

### 4.2 `raw_calendly`
Fivetran Calendly connector.

| Table | Key Fields |
|---|---|
| `event` | `uri`, `status`, `cancel_reason`, `canceled_by`, `canceler_type` (`'invitee'`/`'host'`), `start_time`, `end_time` |
| `event_invitee` | `event_uri`, `email`, `name`, `status`, `rescheduled`, `tracking_utm_*` |
| `event_type` | `uri`, `internal_note` (business-critical — see Section 6.3), `name` |
| `event_membership` | `event_uri`, `user_uri` (maps event to assigned rep) |
| `users` | `uri`, `name`, `email` (rep directory) |

### 4.3 `raw_meta_facebook_ads`
Old Meta ad account. Fivetran dbt Facebook Ads package output.

| Table | Notes |
|---|---|
| `facebook_ads__campaign_report` | Daily campaign grain. Use for `date_day < '2026-03-04'` only |

### 4.4 `raw_meta_2_reports`
New Meta ad account (from 2026-03-04).

| Table | Notes |
|---|---|
| `facebook_ads__campaign_report` | Daily campaign grain. Use for `date_day >= '2026-03-04'` only |

**Never use `raw_meta_2.basic_campaign`** — raw Fivetran table missing `conversions` column.

### 4.5 `raw_ghl`
GoHighLevel data (Airbyte ingestion).

| Table | Description |
|---|---|
| `registrations_weekly_webinar` | Weekly webinar leads — Meta + ManyChat + organic |
| `registrations_weekly_webinar_tiktok` | Same schema, TikTok traffic only |
| `registrations_monthly_workshop` | Monthly Lump Sum Workshop ONLY |
| `contact_tags` | All GHL contact tags. Key columns: `contact_id`, `tag`, `_fivetran_deleted` |
| `contacts` | GHL contact directory. Key columns: `id`, `email` |

UTM/source data lives in a JSON column `others`. Key paths:
- `$.eventData.url_params.utm_source`
- `$.eventData.url_params.utm_medium`
- `$.eventData.url_params.utm_campaign`
- `$.eventData.url_params.ref` — setter identifier: `swp`=Swapnil, `hna`=Hania, `sal`=Salony
- `$.organic_source`

**Key GHL tag patterns used in models:**
| Tag pattern | Meaning |
|---|---|
| `event: webinar-YYYY-MM-DD` | Registered for this specific webinar |
| `event: no show-webinar-YYYY-MM-DD` | Tagged as no-show (manually applied) |
| `status: attended` | Has attended at least one webinar (auto-applied) |
| `webinar registration - [manychat ig dm]` | Registered via ManyChat IG chatbot flow |

### 4.6 `raw_zoom`
Fivetran Zoom connector.

| Table | Key Fields |
|---|---|
| `webinar` | `uuid`, `start_time` (UTC), `_fivetran_deleted` |
| `webinar_participant` | `webinar_uuid`, `user_email`, `name`, `duration` (seconds per join segment — must SUM for total) |

**Timezone critical:** `start_time` is UTC. Wednesday webinars at 8pm ET = midnight UTC Thursday. Always use `DATE(start_time, 'America/New_York')` — never plain `DATE(start_time)`.

### 4.7 `raw_ht_funnelsheet`
Google Sheet (manual data entry).

| Table | Key Fields |
|---|---|
| `weekly_metrics` | `week` (DATE string), `webinar_type`, `page_views`, `webinar_registrations`, `show_ups`, `pitched_show_ups`, `calls_booked`, `calls_held`, `deals_closed`, `revenue_usd`, `cash_usd` |

This is the **source of truth for attendance in Era 1 + 2** (pre-Zoom integration).

### 4.8 `raw_closersheet`
Google Sheet — legacy closer metrics (pre-2025-11-23 only).

| Table | Key Fields |
|---|---|
| `metrics_weekly` | `webinar_week`, `rep_name`, `calls_on_the_calendar`, `live_calls`, `total_closes`, `total_revenue_generated`, `total_cash_collected` |

### 4.9 `raw_fanbasis`
Google Sheet / CSV — Fanbasis + Whop transaction feed.

| Table | Key Fields |
|---|---|
| `sales` | `sale_id`, `email`, `sale_date` (mixed format string!), `product_name`, `amount`, `your_earnings`, `status`, `platform` |

---

## 5. dbt Model Inventory

### Model Lineage
```
raw_airtable.sales_calls
    └── stg_airtable_sales_calls
            └── int_calls_enriched ←── stg_calendly
                    ├── int_closer_performance_core
                    │       └── mart_closer_weekly_performance
                    │               └── (UNION) int_closer_performance_legacy
                    ├── int_funnel_webinar_core
                    │       └── mart_webinar_events
                    │               └── mart_funnel_webinar_performance (view alias)
                    └── int_funnel_webinar_legacy ←── stg_closersheet_metrics_weekly
                                                  └── int_meta_webinar_campaign_spend_weekly

raw_meta_facebook_ads + raw_meta_2_reports
    └── stg_meta_campaigns
            ├── int_meta_webinar_campaign_spend_weekly
            ├── stg_meta_ad_performance_daily
            └── int_funnel_webinar_core (spend routing)

raw_ghl
    ├── stg_ghl_weekly_webinar_regs  ──┐
    ├── stg_ghl_monthly_webinar_regs ──┴── mart_webinar_events
    ├── contact_tags ─────────────────────── mart_webinar_events (ManyChat tag count)
    ├── contact_tags ─────────────────────── int_funnel_webinar_core (setter attribution)
    └── contacts ──────────────────────────── (joined to contact_tags in both above)

raw_ghl + stg_zoom_webinar_attendance
    └── int_webinar_reactivations ────────── mart_webinar_events

raw_zoom
    └── stg_zoom_webinar_attendance ──── mart_webinar_events

raw_ht_funnelsheet
    └── stg_ht_weekly_metrics ──── int_funnel_webinar_core
                                └── int_funnel_webinar_legacy

raw_fanbasis
    └── stg_fanbasis_sales

raw_closersheet
    └── stg_closersheet_metrics_weekly ──── int_funnel_webinar_legacy
                                        └── int_closer_performance_legacy
```

### Models to NEVER Modify
- `int_funnel_webinar_legacy` — frozen Era 1 historical data
- `stg_closersheet_metrics_weekly` — deprecated, historical only
- `mart_closer_weekly_performance` — separate sales mart
- `int_closer_performance_legacy` — legacy aggregates

---

## 6. Staging Models (Detail)

### 6.1 `stg_airtable_sales_calls`
**Materialization:** view  
**Grain:** 1 row = 1 scheduled call appointment  
**Source:** `raw_airtable_nmm___coaching_crm_appyriu7120p0t3kt.sales_calls`

Key transformations:
- Normalizes Airtable's 0/1 flags to proper booleans
- `is_held = is_dispositioned AND NOT is_not_taken` (dispositioned means outcome was recorded; not_taken means prospect didn't take the call)
- `held_week_sun` = Sunday anchor of appointment date (only set when held)
- `deal_week_sun` = Sunday anchor of `date_closed` (only set when closed, strict — no fallback)
- `call_date_time` = raw `appointment_date_time` from Airtable, **never overridden** — use this for sales cycle calculations and Calendly join matching
- `appointment_date_time` = `COALESCE(date_closed AS TIMESTAMP, raw appointment_date_time)` — overrides with close date for deals so they appear in the correct week filter in Looker; do NOT use for time-based matching or cycle calculations

**Flag definitions:**
| Flag | Meaning |
|---|---|
| `is_dispositioned` | Call was given an outcome (f_dispositioned=1) |
| `is_not_taken` | Outcome was recorded but prospect didn't take call (f_not_taken=1) |
| `is_held` | Call actually happened (dispositioned AND NOT not_taken) |
| `is_ghosted` | Prospect ghosted (f_ghosted=1) |
| `is_canceled` | Call was canceled (f_canceled=1) |
| `is_canceled_by_prospect` | Prospect initiated the cancel |
| `is_rescheduled` | Call was rescheduled — new record created for new appointment |
| `is_red_zone` | Red zone flag (at-risk deal) |
| `is_deposit` | Deposit taken (f_deposit=1) |
| `is_deal` | Deal closed (f_closed=1) |

### 6.2 `stg_meta_campaigns`
**Materialization:** table  
**Grain:** 1 row = 1 campaign × calendar day  
**Sources:** Both Meta ad accounts UNIONed at 2026-03-04 cutoff

```sql
-- The UNION logic (critical):
SELECT *, 'old_account' AS account_era
FROM raw_meta_facebook_ads.facebook_ads__campaign_report
WHERE date_day < '2026-03-04'
UNION ALL
SELECT *, 'new_account' AS account_era
FROM raw_meta_2_reports.facebook_ads__campaign_report
WHERE date_day >= '2026-03-04'
```

`link_clicks` / `reach` / `frequency` are LEFT-JOINed in from the raw Fivetran `basic_campaign` tables
(`raw_meta.basic_campaign` for the old account < 2026-03-04, `raw_meta_2.basic_campaign` for the new account ≥ 2026-03-04)
on `(campaign_id, date)` — they are not exposed by `facebook_ads__campaign_report`.

Key derived fields: `spend_usd`, `link_clicks`, `reach`, `frequency`, `cpc_usd`, `cpc_link_usd`, `cpm_usd`, `ctr`, `link_ctr`, `cvr`, `roas`, `week_sun`, `is_webinar_named`, `is_hammer_them_named`, `campaign_category`.

`campaign_category` (used for spend bucketing in `int_funnel_webinar_core` and `mart_webinar_events`):
- `webinar_registration` — weekly webinar/workshop registration campaigns
- `webinar_hammer_them` — weekly webinar "Hammer Them" (show-up retargeting) campaigns (`%hammer%` + `%webinar%`)
- `monthly_workshop_registration` / `monthly_workshop_hammer_them` — Monthly Lump Sum workshop campaigns
- `hammer_them_booked_calls` — book-a-call "Hammer Them" (no "webinar" in the name — excluded from the webinar mart)
- `other` — everything else

### 6.3 `stg_calendly`
**Materialization:** view  
**Grain:** 1 row = 1 Calendly event (latest invitee snapshot via ARRAY_AGG)

**`internal_note` → `calendly_flow_type` mapping (business-critical):**

| `internal_note` (lowercased) | `calendly_flow_type` |
|---|---|
| `'live webinar'` | `'Sunday Webinar'` |
| `'wednesday webinar'` | `'Wednesday Webinar'` |
| `'post-attendee webinar typeform'` | `'Post-Attendee Typeform'` |
| `'live webinar - typeform'` | `'Post-Attendee Typeform'` |
| contains `'webinar'` | `'Webinar'` |
| contains `'setter'` | `'Setter Booked'` |
| contains `'affiliate'` | `'Affiliate'` |
| contains `'skool'` | `'Skool'` |
| contains `'lead magnet'` | `'Lead Magnet'` |

Key fields: `event_uri`, `invitee_email`, `start_time`, `event_created_at`, `cancel_reason`, `canceled_by`, `canceler_type`, `internal_note`, `calendly_flow_type`, `setter_name`, `is_canceled`, `is_webinar_booking`, `created_date`, `created_week_sun`

**Exclusion list (always apply in Calendly queries):**
```sql
WHERE invitee_email NOT LIKE '%@nomoremondays.io%'
  AND invitee_email NOT IN ('jaromir1998@gmail.com', 'marek@sintano.com')
```

### 6.4 `stg_zoom_webinar_attendance`
**Materialization:** table  
**Grain:** 1 row = 1 attendee per webinar date (best session only)

Session selection logic:
1. Count real external attendees per session UUID (excluding internal emails/notetakers)
2. Pick session with `attendee_count > 5` first, then highest count, then non-deleted, then earliest start

`webinar_date` uses `DATE(start_time, 'America/New_York')` — critical for Wednesday 8pm ET webinars.

`is_pitched_attendee = total_duration_seconds > 1500` (> 25 minutes cumulative across re-joins)

**Always exclude:**
```sql
WHERE LOWER(user_email) NOT LIKE '%@nomoremondays.io%'
  AND LOWER(user_email) NOT IN ('jaromir1998@gmail.com','marek@sintano.com','office@spark-value.com')
  AND LOWER(name) NOT LIKE '%notetaker%'
```

### 6.5 `stg_ghl_weekly_webinar_regs`
**Materialization:** table  
**Grain:** 1 row = 1 GHL form submission  
**Sources:** `registrations_weekly_webinar` UNION `registrations_weekly_webinar_tiktok`

**Traffic source classification (priority order):**
| Condition | `traffic_source` |
|---|---|
| From TikTok table OR `utm_source = 'tiktok'` | `'tiktok'` |
| `organic_source = 'manychat'` | `'manychat'` (wins over paid UTMs) |
| `utm_medium = 'paid'` AND `utm_source IN ('fb','ig','an')` or `fb%` or `'th'` | `'meta'` |
| `ref_param IN ('swp','hna','sal')` | `'setter'` (setter-sent link) |
| `utm_source LIKE '%skool%'` | `'skool'` |
| `utm_source = 'convertkit'` or `utm_medium = 'email'` | `'email'` |
| `utm_source IN ('ig','hoobe')` or `utm_medium = 'social'` | `'organic_social'` |
| Otherwise | `'direct_or_unknown'` |

**Note on ManyChat registrants:** `organic_source = 'manychat'` on LP forms is almost always 0. ManyChat chatbot registrations bypass the LP form entirely — they go through the IG DM flow and are tagged `webinar registration - [manychat ig dm]` in GHL contact_tags. `mart_webinar_events` counts these via the tag, not the form field.

**Webinar attribution (promo window):**
```sql
CASE
  WHEN EXTRACT(DAYOFWEEK FROM created_date) IN (2,3,4) -- Mon/Tue/Wed
    THEN DATE_ADD(created_date, INTERVAL (4 - EXTRACT(DAYOFWEEK FROM created_date)) DAY) -- → Wednesday
  ELSE
    DATE_ADD(created_date, INTERVAL MOD(8 - EXTRACT(DAYOFWEEK FROM created_date), 7) DAY) -- → Sunday
END AS attributed_webinar_date
```

### 6.6 `stg_ghl_monthly_webinar_regs`
**Materialization:** table  
**Source:** `raw_ghl.registrations_monthly_workshop` ONLY  
**Attribution:** 14-day lookback window to nearest upcoming workshop date (from `stg_ht_weekly_metrics` where `webinar_type = 'Monthly Workshop'`)

### 6.7 `stg_ht_weekly_metrics`
**Materialization:** table  
**Grain:** 1 row = 1 webinar event  
**Source:** `raw_ht_funnelsheet.weekly_metrics` (manual Google Sheet)

Key fields: `week` (DATE — the webinar date), `webinar_type` (`'Sunday'`/`'Wednesday'`/`'Monthly Workshop'`), `page_views`, `webinar_registrations`, `show_ups`, `pitched_show_ups`

`webinar_type` inferred from day-of-week if not filled in sheet: DOW=1 → Sunday, DOW=4 → Wednesday.

### 6.8 `stg_closersheet_metrics_weekly`
**Materialization:** table  
**Era:** Legacy only (pre-2025-11-23)  
**Grain:** 1 row = 1 rep × webinar week  

Fields: `webinar_week`, `rep_name`, `calls_on_the_calendar`, `live_calls`, `total_closes`, `total_revenue_generated_usd`, `total_cash_collected_usd`, plus derived rates (_pct suffix)

### 6.9 `stg_fanbasis_sales`
**Materialization:** table  
**Grain:** 1 row = 1 transaction  
**Note:** `sale_date` is a mixed-format STRING — model uses `SAFE.PARSE_DATETIME` with multiple patterns.

Key derived fields:
- `product_category`: `'The Freedom Creator Accelerator'` vs `'Skool'`
- `payment_week_cohort`: Sunday of the customer's FIRST payment week (window function)
- `payment_sequence_number`: payment order per email
- `new_or_repeat`: `'New Customer'` (first payment or same cohort week) vs `'Repeat Customer'`
- `total_paid_to_date_usd`: cumulative running sum per email

### 6.10 `stg_meta_ad_performance_daily`
**Materialization:** table  
**Grain:** 1 row = 1 campaign × calendar day (`campaign_category IN ('webinar_registration','webinar_hammer_them')`)  
**Purpose:** Looker Studio drill-through dashboard for ad campaign performance.
Exposes `campaign_category`, `is_hammer_them_named`, `link_clicks`, `reach`, `frequency`, `cpc_link_usd`, `link_ctr`
in addition to spend/impressions/clicks/conversions. Also keeps `campaign_keyword` (`'webinar'`/`'workshop'`) for back-compat.

**Webinar date attribution — does NOT apply the 50/50 Sunday split** (per-day grain): the whole Sunday day is
attributed to the Sunday webinar. So per-webinar roll-ups here differ slightly from `mart_webinar_events` on weeks
that have both a Sunday and a Wednesday webinar.
```sql
CASE
  WHEN dow IN (5,6,7,1) THEN upcoming_sunday          -- Thu-Sun → Sunday
  WHEN dow IN (2,3,4) AND week_start IN wed_weeks THEN wednesday  -- Mon-Wed in wed weeks
  ELSE upcoming_sunday                                  -- Mon-Wed in non-wed weeks
END AS webinar_date
```
(BigQuery DOW: Sun=1, Mon=2, Tue=3, Wed=4, Thu=5, Fri=6, Sat=7)

---

## 7. Intermediate Models (Detail)

### 7.1 `int_calls_enriched`
**Materialization:** view  
**Grain:** 1 row = 1 Airtable call record  
**Sources:** `stg_airtable_sales_calls` LEFT JOIN `stg_calendly`

This is the **primary source for all closer/setter performance analysis**. The Calendly join enriches each call record with booking source, setter identity, and cancellation detail.

**Calendly match logic:** fuzzy join on `(email, ±5 minutes of call_date_time)` — uses the raw call timestamp, NOT `appointment_date_time` (which is overridden to `date_closed` for deals and would prevent any match)

**`final_marketing_flow`** — the authoritative marketing attribution field:
```sql
COALESCE(airtable_source, calendly_flow_type)
```
Values: `'Webinar'`, `'Wednesday Webinar'`, `'Post-Attendee Webinar Typeform'`, `'Setter Booked'`, `'Lead Magnet'`, `'Affiliate'`, `'Skool'`, `'Website'`

**`booking_week_sun`** — derived from `COALESCE(calendly_created_ts, airtable_created_date)` anchored to Sunday. Calendly timestamp preferred as more accurate booking time.

**`held_call_number`** — windowed COUNTIF of held calls per email ordered by `appointment_date_time`. Used to determine OCC vs FUC.

**Close path fields:**
| Field | Values | Logic |
|---|---|---|
| `close_type` | `'OCC'`, `'FUC'`, NULL | OCC = first held call close; FUC = subsequent |
| `close_path_tag` | `'Webinar OCC'`, `'Webinar FUC'`, `'Setter OCC'`, etc. | Combines flow + close_type |

**Funnel stage eligibility fields:**
| Field | Logic | Used as |
|---|---|---|
| `is_show_rate_eligible` | `is_dispositioned AND NOT is_rescheduled AND call_outcome != 'Setter DQ'` | Show rate denominator — "Calls on Calendar" |
| `is_show_up` | `is_held AND call_outcome != 'Setter DQ'` | Show-up count — use this, NOT `is_call_held` |
| `is_close_rate_eligible` | `is_held AND call_outcome NOT IN ('Setter DQ', 'Closer DQ')` | Close rate denominator — "Qualified Show-ups" |
| `call_status_category` | See table below | **Primary** Looker drill-down — non-NULL for every row |
| `not_taken_category` | See table below | Scoped drill-down — NULL for held calls (intentional) |

**⚠️ `is_call_held` is misleading — do not use for show-up counts.** Airtable marks Setter DQ calls as `is_held=True` (data quirk). Always use `is_show_up` instead, which correctly excludes Setter DQ.

**Internal funnel stage terminology:**
| Stage name | Model field / Looker formula |
|---|---|
| **Prospects** | `COUNT_DISTINCT(CASE WHEN is_call_booked THEN prospect_email_lc END)` |
| **Calls on Calendar** | `COUNT_DISTINCT(CASE WHEN is_show_rate_eligible THEN prospect_email_lc END)` |
| **Show Ups** | `COUNT_DISTINCT(CASE WHEN is_show_up THEN prospect_email_lc END)` |
| **Qualified Show-ups** | `COUNT_DISTINCT(CASE WHEN is_close_rate_eligible THEN prospect_email_lc END)` |
| **Deals Closed** | `COUNT_DISTINCT(CASE WHEN is_deal THEN prospect_email_lc END)` |

Why each stage differs from the previous:
- Prospects → Calls on Calendar: removes rescheduled appointments and Setter DQ'd calls
- Calls on Calendar → Show Ups: removes no-shows, ghosts, cancels
- Show Ups → Qualified Show-ups: removes Closer DQ (call happened but closer disqualified the prospect)
- Qualified Show-ups → Deals Closed: the close rate proper

**Known confusing/duplicate fields in `int_calls_enriched`:**
| Field | Note |
|---|---|
| `is_call_held` | ⚠️ Misleading — TRUE for Setter DQ. Use `is_show_up` instead |
| `booking_week_sun` | ✅ Correct — derived from `COALESCE(calendly_created_ts, airtable_created_date)` |
| `airtable_booking_week_sun` | ⚠️ Raw Airtable field — Fivetran sync time, not reliable booking date |
| `appointment_date_time` | ⚠️ Overridden to `date_closed` for deals — do NOT use for time matching or cycle calculations |
| `call_date_time` | ✅ Raw unmodified call timestamp — use this for Calendly join and cycle calculations |
| `final_marketing_flow` | ✅ Authoritative attribution — always use this, not `airtable_source` or `calendly_flow_type` |
| `deal_value` / `cash_value` | Legacy convenience = `COALESCE(revenue_generated/cash_collected, 0)` |

**`call_status_category` values — non-NULL for every row (primary Looker dimension):**
| Value | Condition |
|---|---|
| `'Setter DQ'` | `call_outcome = 'Setter DQ'` (checked first — Airtable marks these as is_held=True) |
| `'Closer DQ'` | `call_outcome = 'Closer DQ'` |
| `'Closed'` | `is_held AND is_deal` |
| `'Held — Not Closed'` | `is_held` (not a deal) |
| `'Rescheduled'` | `is_rescheduled = TRUE` |
| `'No Show'` | `is_ghosted = TRUE` |
| `'Cancelled by Prospect'` | `is_canceled_by_prospect OR calendly_canceler_type = 'invitee'` |
| `'Cancelled'` | `is_canceled = TRUE` (host-side) |
| `'Not Taken (Other)'` | `is_not_taken = TRUE` |
| `'Unknown'` | Fallback |

Use `call_status_category` as the dimension in Looker Studio breakdown charts — it never produces NULL rows.

**`not_taken_category` values — scoped to "not held" calls only (NULL for held calls is intentional):**
| Category | Condition |
|---|---|
| `'Setter DQ'` | `call_outcome = 'Setter DQ'` (checked FIRST — before is_held) |
| `NULL` | `is_held = TRUE` (held call — intentionally NULL here) |
| `'Rescheduled'` | `is_rescheduled = TRUE` |
| `'Ghosted'` | `is_ghosted = TRUE` |
| `'Cancelled by Prospect'` | `is_canceled_by_prospect OR calendly_canceler_type = 'invitee'` |
| `'Cancelled'` | `is_canceled = TRUE` |
| `'Not Taken (Other)'` | `is_not_taken = TRUE` (catch-all) |

**`loss_reason_display`:**
- Held, not closed: `COALESCE(reasons_they_didn_t_close, call_outcome)`
- Not held, rescheduled: `NULL`
- Not held (other): `not_taken_reason || ' | ' || calendly_cancel_reason` (concatenated when both present; falls back to whichever is available, then `call_outcome`)

**Sales cycle fields:**
- `booking_to_close_days`: `DATE_DIFF(date_closed, DATE(calendly_created_ts, 'America/New_York'), DAY)` — **only populated when `calendly_created_ts IS NOT NULL`**. Airtable `created_date` is the Fivetran sync time (not the booking date), so it's unreliable. Only Calendly has a real booking timestamp.
- `call_to_close_days`: `DATE_DIFF(date_closed, DATE(call_date_time, 'America/New_York'), DAY)` — uses ET timezone to avoid -1 day artifacts for late-evening calls stored as next-day UTC. NULL for non-deal rows.

**All output columns:**

```
id, appointment_id, prospect_name, prospect_email_lc,
closer_owner, setter_owner, triage_caller, calendly_setter_name,
call_outcome,
created_time, created_date, airtable_created_date, calendly_created_ts,
calendly_start_time, appointment_date_time, call_date_time,
held_week_sun, date_closed, deal_week_sun,
booking_week_sun, airtable_booking_week_sun, appointment_week_sun,
airtable_source, calendly_flow_type, final_marketing_flow, internal_note,
calendly_cancel_reason, calendly_canceled_by, calendly_canceler_type,
is_webinar_flow, is_setter_flow, is_affiliate_flow, is_website_flow,
is_skool_flow, is_lead_magnet_flow,
is_call_booked, is_dispositioned, is_call_held,
is_not_taken, is_rescheduled, is_ghosted, is_canceled,
is_canceled_by_prospect, is_red_zone, is_deposit, is_deal,
held_call_number,
close_type, close_path_tag,
booking_to_close_days, call_to_close_days,
is_show_rate_eligible, is_show_up, is_close_rate_eligible,
call_status_category, not_taken_category, loss_reason_display,
product, product_type, payment_type, payment_notes,
cash_collected, deposit_collected, revenue_generated, revenue_predicted,
deal_value, cash_value,
not_taken_reason, reasons_they_didn_t_close, client_notes,
what_went_well_, what_can_i_improve_on_, manager_help_requested, pre_call_reachout
```

### 7.2 `int_funnel_webinar_legacy`
**Materialization:** table  
**Era:** Pre-2025-11-23 only (`WHERE week_start < DATE '2025-11-23'`)  
**FROZEN — never modify**

Sources: `stg_ht_weekly_metrics` (spine) + `stg_closersheet_metrics_weekly` (outcomes) + `stg_meta_campaigns` via `int_meta_webinar_campaign_spend_weekly` (spend) + `stg_calendly` (call bookings)

Output: same schema as `int_funnel_webinar_core` for UNION compatibility.

### 7.3 `int_funnel_webinar_core`
**Materialization:** table  
**Era:** 2025-11-23 onwards (`WHERE webinar_date >= DATE '2025-11-23'`)

Produces three UNION'd row sets: Sunday webinars, Wednesday webinars, Monthly Workshop.

**Spend routing logic (critical):**
- Days Thu–Sun (DOW 5,6,7,1): attributed to upcoming Sunday
- Days Mon–Wed (DOW 2,3,4) in a week that HAS a Wednesday webinar: attributed to that Wednesday
- Days Mon–Wed in a week WITHOUT a Wednesday webinar: attributed to upcoming Sunday
- Wednesday weeks identified via: `stg_ht_weekly_metrics WHERE webinar_type = 'Wednesday'`

**Call attribution from `int_calls_enriched`:**
- Sunday: `final_marketing_flow = 'Webinar'` OR Post-Attendee Typeform created Thu–Sun
- Wednesday: `final_marketing_flow = 'Wednesday Webinar'` OR Post-Attendee Typeform created Mon–Wed
- **Setter webinar attribution (all types):** Setter-booked calls (`final_marketing_flow LIKE '%Setter%'`) are attributed to the webinar if: (1) the contact has `event: webinar-DATE` tag on or before booking week AND (2) has `status: attended` tag. Most recent qualifying webinar date is used. These outcomes are additive — no double-counting with the direct webinar flows above.

### 7.4 `int_webinar_reactivations`
**Materialization:** table  
**Grain:** 1 row = 1 webinar date (Era 3 only — requires Zoom attendance data)  
**Used by:** `mart_webinar_events` Section 6

Identifies contacts who were tagged as no-shows on a prior webinar and then came back to the NEXT webinar.

| Column | Description |
|---|---|
| `webinar_date` | The "comeback" webinar date |
| `reactivation_pool_size` | Contacts tagged no-show on any prior webinar whose next webinar is this one |
| `reactivations_attended` | Pool contacts who actually showed up (Zoom email match) |
| `reactivations_booked` | Pool contacts who booked a call within 7 days of this webinar |
| `is_reactivation_data_available` | Always `TRUE` in this model (only Era 3 rows exist) |

### 7.6 `int_meta_webinar_campaign_spend_weekly`
**Materialization:** view  
**Grain:** 1 row = 1 webinar Sunday  
**Used by:** `int_funnel_webinar_legacy` only

Simple upcoming-Sunday attribution: every calendar day maps to its upcoming Sunday. Filters to `LIKE '%webinar%'` OR `LIKE '%lump sum%'` campaigns with spend > 0 or impressions > 0.

### 7.7 `int_closer_performance_core`
**Materialization:** table  
**Grain:** 1 row = 1 closer × appointment date  
**Source:** `int_calls_enriched`

Key metrics per (appt_date, closer_name):
- `calls_on_the_calendar`, `prospects_on_the_calendar`
- `calls_held`, `unique_calls_held`, `dispositioned_prospects`
- `deals_closed_won`, `deposits_taken`, `one_call_closes`, `followup_closes`
- `revenue_generated`, `cash_collected`, `deposit_collected`, `revenue_predicted`
- `show_rate` = unique_calls_held / dispositioned_prospects
- `close_rate` = deals_closed_won / unique_calls_held
- `occ_rate` = one_call_closes / deals_closed_won
- `collection_rate` = cash_collected / revenue_generated
- `avg_days_to_close` = AVG(DATE_DIFF(date_closed, created_date, DAY))
- `avg_revenue_per_deal_acv`, `avg_cash_per_deal_aov`

### 7.8 `int_closer_performance_legacy`
**Materialization:** table  
**Era:** Pre-2025-11-23 (`< DATE '2025-11-23'`)  
**Source:** `stg_closersheet_metrics_weekly`

Weekly-grain data proxied to match core schema. `occ_rate` = NULL (not available historically). `is_legacy_data = TRUE`.

---

## 8. Mart Models (Detail)

### 8.1 `mart_webinar_events`
**Materialization:** table  
**Grain:** 1 row = 1 webinar event — 57 columns  
**~51 rows total** (as of May 2026)  
**This is the canonical webinar performance mart — primary dashboard source.**

Covers all three eras and all three webinar types via UNION of `int_funnel_webinar_core` + `int_funnel_webinar_legacy`.

**Complete column list:**

| Column | Type | Description |
|---|---|---|
| `webinar_date` | DATE | The actual webinar date |
| `webinar_day` | STRING | `'Sunday'`, `'Wednesday'`, `'Monthly Workshop'` |
| `booking_week_sun` | DATE | Sunday anchor for booking/attribution |
| `week_start` | DATE | Sunday of the calendar week (backward compat) |
| `data_era` | STRING | `'legacy'`, `'core_old_ads'`, `'core_new_ads'` |
| `is_legacy` | BOOL | True for pre-2025-11-23 rows |
| `lp_page_views` | INT64 | Landing page views (funnelsheet) |
| `lp_opt_ins` | INT64 | LP opt-ins (funnelsheet `webinar_registrations`) |
| `lp_opt_in_rate` | FLOAT64 | lp_opt_ins / lp_page_views |
| `total_webinar_ad_spend` | FLOAT64 | All "webinar" Meta campaigns (registration + Hammer-Them) over the promo window. Sunday's day is split 50/50 with the following Wednesday webinar. = webinar_reg_ad_spend + webinar_hammer_them_ad_spend |
| `webinar_reg_ad_spend` | FLOAT64 | Registration campaigns only (total − hammer-them) |
| `webinar_hammer_them_ad_spend` | FLOAT64 | Show-up retargeting ("Hammer Them") campaigns only |
| `frequency_webinar_hammer_them` | FLOAT64 | Meta frequency for the Hammer-Them campaign(s) over the window. APPROXIMATE: SUM(impressions)/MAX(daily reach). NULL when no reach data / legacy. |
| `meta_impressions` | FLOAT64 | REGISTRATION campaigns only; ½·Sun split (fractional on split rows) |
| `meta_link_clicks` | FLOAT64 | inline_link_clicks (link clicks, not all clicks), registration campaigns only, ½·Sun split. Renamed from `meta_clicks`. |
| `meta_reported_conversions` | FLOAT64 | Conversions reported by Meta, registration campaigns only, ½·Sun split |
| `meta_ctr` | FLOAT64 | meta_link_clicks / meta_impressions |
| `meta_cvr` | FLOAT64 | meta_reported_conversions / meta_link_clicks |
| `meta_cpl` | FLOAT64 | webinar_reg_ad_spend / meta_reported_conversions |
| `lp_form_submissions` | INT64 | GHL LP form submissions only (Era 2+3; NULL for legacy) |
| `total_registrants` | INT64 | `lp_form_submissions` + ManyChat chatbot-only contacts (deduped) |
| `meta_registrants` | INT64 | LP form subs where `traffic_source = 'meta'` |
| `tiktok_registrants` | INT64 | LP form subs where `traffic_source = 'tiktok'` |
| `manychat_registrants` | INT64 | Tag-based count: contacts with `webinar registration - [manychat ig dm]` + `event: webinar-DATE` tags. Chatbot flow only — does NOT come from LP form. |
| `setter_registrants` | INT64 | LP form subs where `ref_param IN ('swp','hna','sal')` |
| `other_organic_registrants` | INT64 | `lp_form_submissions - meta - tiktok - setter` (excludes ManyChat, which is separate) |
| `unique_attendees` | INT64 | COALESCE(Zoom unique attendees, funnelsheet show_ups) |
| `pitched_attendees` | INT64 | COALESCE(Zoom pitched >25min, funnelsheet pitched_show_ups) |
| `reg_to_attend_rate` | FLOAT64 | unique_attendees / total_registrants (legacy rows: / lp_opt_ins) |
| `attend_to_pitched_rate` | FLOAT64 | pitched_attendees / unique_attendees |
| `cash_collected_per_attendee` | FLOAT64 | cash_collected / unique_attendees |
| `contract_value_per_attendee` | FLOAT64 | revenue_generated / unique_attendees |
| `reactivation_pool_size` | INT64 | Prior no-show contacts whose next webinar is this one (Era 3 only; 0 for earlier eras) |
| `reactivations_attended` | INT64 | Pool contacts who actually showed up to this webinar |
| `reactivations_booked` | INT64 | Pool contacts who booked a call within 7 days |
| `is_reactivation_data_available` | BOOL | TRUE for Era 3 webinars; FALSE for Era 1-2 |
| `calls_booked` | INT64 | Total Calendly bookings (incl. canceled) |
| `calls_booked_active` | INT64 | Non-canceled bookings (dynamic, re-evaluates each run) |
| `calls_held` | INT64 | Calls actually held (from Airtable) |
| `webinar_deposits` | INT64 | Deposit count |
| `deals_closed` | INT64 | Closed deals |
| `cash_collected` | NUMERIC | Cash received |
| `deposit_collected` | NUMERIC | Deposit amounts |
| `revenue_generated` | NUMERIC | Contracted revenue |
| `revenue_predicted` | NUMERIC | Pipeline value |
| `paid_cpr` | FLOAT64 | webinar_reg_ad_spend / meta_registrants (true paid cost per registration) |
| `blended_cpa` | FLOAT64 | total_webinar_ad_spend / unique_attendees |
| `blended_cpbc` | FLOAT64 | total_webinar_ad_spend / calls_booked |
| `blended_cost_per_held_call` | FLOAT64 | total_webinar_ad_spend / calls_held |
| `cac` | FLOAT64 | total_webinar_ad_spend / deals_closed |
| `roas_cash` | FLOAT64 | cash_collected / total_webinar_ad_spend |
| `roas_revenue` | FLOAT64 | revenue_generated / total_webinar_ad_spend |
| `pitch_to_book_rate` | FLOAT64 | calls_booked / pitched_attendees |
| `reg_to_book_rate` | FLOAT64 | calls_booked / total_registrants (legacy rows: / lp_opt_ins) |
| `spend_account_era` | STRING | `'old_account'` or `'new_account'` |
| `zoom_session_uuid` | STRING | Zoom session UUID for this date |
| `dbt_updated_at` | TIMESTAMP | When the mart was last rebuilt |

### 8.2 `mart_funnel_webinar_performance`
**Materialization:** view  
**DEPRECATED** — exists only as backward-compat alias for Looker Studio while dashboards migrate to `mart_webinar_events`.

Filters: `WHERE webinar_day IN ('Sunday', 'Monthly Workshop')` — excludes Wednesday.  
Maps `mart_webinar_events` columns to the original schema: `total_webinar_ad_spend AS ad_spend`,
`lp_form_submissions AS webinar_registrations`, `unique_attendees AS show_ups`, `pitched_attendees AS pitched_show_ups`,
`calls_booked AS webinar_calls_booked`, `calls_held AS webinar_calls_held`, `deals_closed AS webinar_deals`,
`blended_cpbc AS cost_per_booked_call`, `blended_cost_per_held_call AS cost_per_held_call`, `cac AS cost_per_close`,
`is_legacy AS is_legacy_data`. Because `blended_cpr` was removed from the mart, `cost_per_registration` is recomputed
inline: `ROUND(SAFE_DIVIDE(total_webinar_ad_spend, NULLIF(total_registrants, 0)), 2)`.

**Delete this once Looker Studio is updated.**

### 8.3 `mart_closer_weekly_performance`
**Materialization:** table  
**Grain:** 1 row = 1 closer × day (core) or 1 closer × week (legacy)

UNION of `int_closer_performance_core` (Airtable, call-level) and `int_closer_performance_legacy` (closersheet, weekly aggregates). `is_legacy_data` flag distinguishes them.

### 8.4 `stg_meta_ad_performance_daily`
**Materialization:** table  
**Grain:** 1 row = 1 campaign × calendar day  
**Purpose:** Looker Studio campaign drill-through  
**Note:** Despite the `stg_` prefix, this is a Looker-ready mart-equivalent for ad performance.

---

## 9. Looker Studio Dashboard Metrics

### 9.1 Funnel Stage Terminology and Looker Formulas

All Looker Studio calculated fields below are built directly on `int_calls_enriched`.

**The five funnel stages (in order):**

| Stage | Internal name | Looker formula |
|---|---|---|
| **Prospects** | Booked calls | `COUNT_DISTINCT(CASE WHEN is_call_booked THEN prospect_email_lc END)` |
| **Calls on Calendar** | Show rate denominator | `COUNT_DISTINCT(CASE WHEN is_show_rate_eligible THEN prospect_email_lc END)` |
| **Show Ups** | `is_show_up` field | `COUNT_DISTINCT(CASE WHEN is_show_up THEN prospect_email_lc END)` |
| **Qualified Show-ups** | Close rate denominator | `COUNT_DISTINCT(CASE WHEN is_close_rate_eligible THEN prospect_email_lc END)` |
| **Deals Closed** | Closed won | `COUNT_DISTINCT(CASE WHEN is_deal THEN prospect_email_lc END)` |

Why each stage differs:
- **Prospects → Calls on Calendar:** removes rescheduled appointments and Setter DQ'd calls (calls that never should have reached the closer)
- **Calls on Calendar → Show Ups:** removes no-shows, ghosts, and cancels
- **Show Ups → Qualified Show-ups:** removes Closer DQ (call happened, but closer determined prospect didn't qualify — not a "real" sales opportunity)
- **Qualified Show-ups → Deals Closed:** the close rate proper

**Rate formulas:**
```
Show Rate:
COUNT_DISTINCT(CASE WHEN is_show_up THEN prospect_email_lc END)
/ COUNT_DISTINCT(CASE WHEN is_show_rate_eligible THEN prospect_email_lc END)

Close Rate (Qualified Show-up basis — preferred):
COUNT_DISTINCT(CASE WHEN is_close_rate_eligible AND is_deal THEN prospect_email_lc END)
/ COUNT_DISTINCT(CASE WHEN is_close_rate_eligible THEN prospect_email_lc END)

Close Rate (Show-up basis — alternative):
COUNT_DISTINCT(CASE WHEN is_deal THEN prospect_email_lc END)
/ COUNT_DISTINCT(CASE WHEN is_show_up THEN prospect_email_lc END)
```

**Breakdown count formulas (for lower detail table, broken down by `closer_owner`):**
```
Setter DQ:
COUNT_DISTINCT(CASE WHEN call_outcome = 'Setter DQ' THEN prospect_email_lc END)

Closer DQ:
COUNT_DISTINCT(CASE WHEN call_outcome = 'Closer DQ' THEN prospect_email_lc END)

No Shows (Ghosted):
COUNT_DISTINCT(CASE WHEN is_ghosted THEN prospect_email_lc END)

Canceled:
COUNT_DISTINCT(CASE WHEN is_canceled THEN prospect_email_lc END)

Rescheduled:
COUNT_DISTINCT(CASE WHEN is_rescheduled THEN prospect_email_lc END)
```

**Key rule — Setter DQ:** Airtable incorrectly marks Setter DQ calls as `is_dispositioned=True, is_not_taken=False`, making `is_call_held=True`. Always add `AND call_outcome != 'Setter DQ'` to held counts. `is_show_rate_eligible` already excludes Setter DQ from the denominator.

### 9.2 Sales Cycle Metrics

Two fields, each scoped to a different close type. Always use **MEDIAN** — mean is skewed by long-tail FUC outliers.

| Field | Use for | Dashboard formula |
|---|---|---|
| `booking_to_close_days` | **OCC only** — days from Calendly booking → date_closed. Measures webinar funnel speed (registration → cash). NULL when no Calendly match. | `MEDIAN(booking_to_close_days)` filtered to `close_type = 'OCC'` |
| `first_call_to_close_days` | **FUC only** — days from prospect's first ever genuine show-up → date_closed. True follow-up sales cycle length. | `MEDIAN(first_call_to_close_days)` filtered to `close_type = 'FUC'` |

**Observed medians (as of May 2026):**
- OCC: Median booking→close = **2 days** (mean 4.5 — skewed by outliers)
- FUC: Median first-call→close = **21 days** (mean 32.4 — skewed by long-tail deals)

**`call_to_close_days` was removed** — it measured the closing call row's own call_date_time → date_closed, which is 0 for OCC (closes on the day) and also ~0 for most FUC closing calls. Meaningless metric.

Dashboard cards:
```
Median Book > Close Cycle: CONCAT(ROUND(MEDIAN(booking_to_close_days), 1), " days")
  → Filter: close_type = 'OCC'  [shows "Add Filter for OCC/FUC" if not filtered]

Median 1st Call > Close Cycle: CONCAT(ROUND(MEDIAN(first_call_to_close_days), 1), " days")
  → Filter: close_type = 'FUC'  [shows "Add Follow Ups / Lost" if not filtered]
```

### 9.3 Call Disposition Breakdown

**Use `call_status_category` as the primary breakdown dimension in Looker Studio.** Non-NULL for every row. Passes `call_outcome` directly from Airtable; for `call_outcome = 'Not Taken'` rows, substitutes `not_taken_reason` as the label.

```
Actual values in data (as of May 2026):
  Future Call            — booked, appointment in the future, no outcome yet
  MISSING CALL OUTCOME   — past call with no outcome entered (data quality gap)
  Setter DQ              — setter filtered prospect before closer call
  Closer DQ              — closer determined prospect didn't qualify
  Closed - WON           — deal closed
  Follow Up              — held, not closed, follow-up scheduled
  LOST                   — held, presented offer, lost
  Spoke, Not Pitched     — held but closer did not pitch
  Deposit Taken          — deposit collected (partial payment)
  Canceled by Prospect   — prospect cancelled (not_taken_reason = 'Canceled by Prospect')
  Ghosted                — prospect no-showed (not_taken_reason = 'Ghosted')
  Rescheduled            — appointment moved (not_taken_reason = 'Rescheduled')
  Canceled               — host-side cancellation (not_taken_reason = 'Canceled')
  Not Taken              — fallback (is_not_taken=TRUE with no not_taken_reason entered)
  lost                   — 1-row Airtable data entry typo (lowercase)
```

`not_taken_category` is available for "not taken only" drill-downs (NULL for held calls by design). Use with filter `not_taken_category IS NOT NULL`.

### 9.4 Closer Performance Dashboard — All Metric Definitions

Source table: `int_calls_enriched` (all metrics are COUNT DISTINCT on `prospect_email_lc`)

**Funnel volume metrics:**
| Dashboard label | Formula |
|---|---|
| Prospects | `COUNT_DISTINCT(CASE WHEN is_call_booked THEN prospect_email_lc END)` |
| Pending Dispo / Future | `COUNT_DISTINCT(CASE WHEN is_call_booked AND NOT is_dispositioned THEN prospect_email_lc END)` |
| Prospects (D'd) | `COUNT_DISTINCT(CASE WHEN is_dispositioned THEN prospect_email_lc END)` |
| Setter DQ | `COUNT_DISTINCT(CASE WHEN call_outcome = 'Setter DQ' THEN prospect_email_lc END)` |
| Rescheduled | `COUNT_DISTINCT(CASE WHEN is_rescheduled THEN prospect_email_lc END)` |
| Prospects (Setter-Qualified) | `COUNT_DISTINCT(CASE WHEN is_show_rate_eligible THEN prospect_email_lc END)` |
| No Shows (Ghosted) | `COUNT_DISTINCT(CASE WHEN not_taken_reason = 'Ghosted' THEN prospect_email_lc END)` |
| Canceled by Prospect | `COUNT_DISTINCT(CASE WHEN call_status_category = 'Canceled by Prospect' THEN prospect_email_lc END)` |
| Canceled | `COUNT_DISTINCT(CASE WHEN call_status_category = 'Canceled' THEN prospect_email_lc END)` |
| Shows (Setter-Qualified) | `COUNT_DISTINCT(CASE WHEN is_show_up THEN prospect_email_lc END)` |
| Closer DQ | `COUNT_DISTINCT(CASE WHEN call_outcome = 'Closer DQ' THEN prospect_email_lc END)` |
| Shows (Closer-Qualified) | `COUNT_DISTINCT(CASE WHEN is_close_rate_eligible THEN prospect_email_lc END)` |
| Deposits | `COUNT_DISTINCT(CASE WHEN is_deposit THEN prospect_email_lc END)` |
| Deals | `COUNT_DISTINCT(CASE WHEN is_deal THEN prospect_email_lc END)` |

**Rate metrics:**
| Dashboard label | Formula |
|---|---|
| Setter DQ Rate | `COUNT_DISTINCT(Setter DQ) / COUNT_DISTINCT(is_dispositioned)` |
| Closer DQ Rate | `COUNT_DISTINCT(Closer DQ) / COUNT_DISTINCT(is_show_up)` |
| Prospect (SQ) → Show (SQ) % | `COUNT_DISTINCT(is_show_up) / COUNT_DISTINCT(is_show_rate_eligible)` — show rate |
| Prospect (D'd) → Show (CQ) % | `COUNT_DISTINCT(is_close_rate_eligible) / COUNT_DISTINCT(is_dispositioned)` — blended funnel efficiency |
| Show (CQ) → Close % | `COUNT_DISTINCT(is_deal) / COUNT_DISTINCT(is_close_rate_eligible)` — close rate |
| Prospect (D'd) → Close % | `COUNT_DISTINCT(is_deal) / COUNT_DISTINCT(is_dispositioned)` — overall conversion |
| OCC % | `COUNT_DISTINCT(close_type='OCC') / COUNT_DISTINCT(is_deal)` — one-call-close rate |

**Revenue / value metrics:**
| Dashboard label | Formula |
|---|---|
| Cash (USD) | `SUM(cash_collected)` |
| TCV (USD) | `SUM(revenue_generated)` |
| AOV (USD) | `SUM(cash_collected) / COUNT_DISTINCT(CASE WHEN is_deal THEN prospect_email_lc END)` |
| ACV (USD) | `SUM(revenue_generated) / COUNT_DISTINCT(CASE WHEN is_deal THEN prospect_email_lc END)` |
| Dollars Per Prospect (D'd) | `SUM(CASE WHEN is_deal THEN cash_collected END) / COUNT_DISTINCT(CASE WHEN is_dispositioned THEN prospect_email_lc END)` |
| Dollars Per Show (SQ) | `SUM(CASE WHEN is_deal THEN cash_collected END) / COUNT_DISTINCT(CASE WHEN is_show_up THEN prospect_email_lc END)` |

**Sales cycle metrics (median, not mean):**
| Dashboard label | Formula | Filter required |
|---|---|---|
| Median Book → Close Cycle | `CONCAT(ROUND(MEDIAN(booking_to_close_days), 1), " days")` | `close_type = 'OCC'` |
| Median 1st Call → Close Cycle | `CONCAT(ROUND(MEDIAN(first_call_to_close_days), 1), " days")` | `close_type = 'FUC'` |

**Note on COUNT DISTINCT vs row count:** All prospect-level metrics use `COUNT_DISTINCT(prospect_email_lc)`. This means the funnel stages do NOT mathematically reconcile via subtraction (a prospect who ghosted once and showed up later counts in both). For a perfectly additive waterfall use `COUNT(id)` (row-level counts). Median cycle metrics use row-level aggregation (no DISTINCT needed).

---

## 10. Key Business Rules and Attribution Logic

### 10.1 Promo Window Attribution (GHL Registrations)
```
Mon/Tue/Wed submission → attributed to that Wednesday
Thu/Fri/Sat/Sun submission → attributed to that/upcoming Sunday
```
This is inlined in SQL — not driven by a lookup table.

### 10.2 Calendly Booking Attribution
Bookings arrive in the DAYS AFTER each webinar:
- **Sunday booking window:** Sun night → Tue (flow type = `'Sunday Webinar'`)
- **Wednesday booking window:** Wed night → Fri (flow type = `'Wednesday Webinar'`)
- **Post-Attendee Typeform:** created Mon–Wed → Wednesday; created Thu–Sun → Sunday

### 10.3 Spend Routing (Dynamic Wednesday Detection)
Whether a Mon–Wed spend day goes to Wednesday or Sunday depends on whether that week has a Wednesday webinar in `stg_ht_weekly_metrics`. This is recalculated dynamically every dbt run — adding a Wednesday webinar to the funnelsheet retroactively re-routes that week's spend.

### 10.4 Attendance Fallback Chain
```
Era 3 (2026-03-04+): Zoom (stg_zoom_webinar_attendance)
Era 1-2 (pre-2026-03-04): funnelsheet show_ups from stg_ht_weekly_metrics
```
COALESCE: `COALESCE(zoom_attendees, funnelsheet_show_ups)`

### 10.5 Revenue Fields Explained
| Field | Meaning |
|---|---|
| `revenue_generated` | Total contracted value (full program price) |
| `cash_collected` | Cash actually received to date |
| `deposit_collected` | Initial deposit only |
| `revenue_predicted` | Pipeline estimate for in-progress deals |
| `deal_value` | `COALESCE(revenue_generated, 0)` |
| `cash_value` | `COALESCE(cash_collected, 0)` |

`roas_cash` uses cash_collected (conservative). `roas_revenue` uses revenue_generated (optimistic).

### 10.6 OCC vs FUC
- **OCC (One Call Close):** `is_deal=TRUE AND held_call_number=1`
- **FUC (Follow-Up Close):** `is_deal=TRUE AND held_call_number > 1`
- `held_call_number` is a running count of held calls per prospect email, ordered by `appointment_date_time`

---

## 11. Known Data Quirks and Edge Cases

### 11.1 Zoom UTC → ET Timezone
Wednesday webinars are at 8pm ET. In UTC that's midnight–1am Thursday. Always use:
```sql
DATE(start_time, 'America/New_York')
```
Never `DATE(start_time)` for Zoom data.

### 11.2 Setter DQ Flag Inconsistency
Airtable records `call_outcome = 'Setter DQ'` with `f_dispositioned=1, f_not_taken=0`, making `is_call_held=True`. This is incorrect — these calls were NOT held. The model handles this by:
- Checking `call_outcome = 'Setter DQ'` BEFORE the `is_held` check in `not_taken_category`
- Excluding from `is_show_rate_eligible`
- Requiring `AND call_outcome != 'Setter DQ'` on held counts in Looker
If Airtable is fixed to set `f_not_taken=1` for Setter DQ, the model remains correct.

### 11.3 Duplicate Zoom Sessions
Some webinar dates have both a deleted session and a live session (rescheduled webinars). The model prefers the session with the most real attendees (>5). If only a deleted session exists, it's used as ground truth — it still contains real attendance data.

### 11.4 Rescheduled Calls as Separate Records
Per Tyler (Ops): rescheduled calls create a NEW Airtable record. The original record stays with `f_rescheduled=1`. This means:
- A prospect with two records (original + rescheduled) appears twice
- `is_rescheduled=True` rows should be excluded from show rate denominator
- `is_show_rate_eligible` handles this automatically

### 11.5 Closed-Won with No Disposition
A small number of rows have `is_deal=True` but `is_dispositioned=False`. This inflates close rate slightly (included in numerator but excluded from denominator). Likely data entry errors in Airtable.

### 11.6 Future Call with Disposition Flag
Small group of `call_outcome='Future Call'` rows with `is_dispositioned=True, is_call_held=True`. This is a data entry error (closer marked disposition on a future booking). `is_show_rate_eligible=False` correctly excludes these via the `call_outcome != 'Setter DQ'` check... no, actually these would pass through as `is_show_rate_eligible=True`. Known limitation; low volume.

### 11.7 Fanbasis Sale ID Duplicates
`stg_fanbasis_sales` has 2 duplicate `sale_id` values — known data quality issue, set to WARN not ERROR in schema tests.

### 11.8 Legacy Closer Rate Out of Range
One row in `stg_closersheet_metrics_weekly` has `follow_ups_show_up_rate > 1` — data entry error in the historical Google Sheet. Set to WARN.

### 11.9 Meta `conversions` Column
Never use `raw_meta_2.basic_campaign` (raw Fivetran table) — it's missing the `conversions` column. Always use `raw_meta_2_reports.facebook_ads__campaign_report` (dbt-transformed).

### 11.10 Post-Attendee Typeform Attribution
This Calendly flow type (`internal_note = 'post-attendee webinar typeform'` or `'live webinar - typeform'`) doesn't self-identify as Sunday vs Wednesday. Attribution uses the creation date's day-of-week:
- Mon/Tue/Wed → Wednesday webinar
- Thu/Fri/Sat/Sun → Sunday webinar

### 11.11 `appointment_date_time` is NOT the Raw Call Time for Deals
`stg_airtable_sales_calls` sets `appointment_date_time = COALESCE(date_closed AS TIMESTAMP, raw_appointment_time)`. This was intentional: it ensures closed deals appear in the correct week filter in Looker (filtering by appointment week shows the deal in the close week). However, this means:
- For closed deals, `appointment_date_time` is midnight on the close date, NOT the actual call time
- **Never use `appointment_date_time` for Calendly join matching** — use `call_date_time`
- **Never use `appointment_date_time` for cycle calculations** — use `call_date_time`
- `call_date_time` is the dedicated field that always holds the raw, unmodified call timestamp

### 11.12 Airtable `created_date` Is the Fivetran Sync Time, Not Booking Date
For records without a Calendly match, `airtable_created_date` ≈ when Fivetran synced the record, which is often the same day or day after the close (closers typically create the Airtable record on the day of or after the call). This makes it useless as a "booking date." `booking_to_close_days` is therefore gated on `calendly_created_ts IS NOT NULL` — only populate when Calendly provides a real booking timestamp.

### 11.13 Monthly Workshop Spend Attribution
Monthly workshop uses a broader campaign filter (adds `%monthly%`, `%lump sum%`) vs weekly webinar spend. Monthly workshop Calendly bookings reuse the `'Sunday Webinar'` flow type. Airtable calls use `final_marketing_flow = 'Webinar'` (same as Sunday).

---

## 12. Internal Emails to Always Exclude

These internal/test emails must be excluded from all analyses involving Zoom and Calendly:

```sql
-- Zoom:
user_email NOT LIKE '%@nomoremondays.io%'
AND user_email NOT IN ('jaromir1998@gmail.com','marek@sintano.com','office@spark-value.com')
AND LOWER(name) NOT LIKE '%notetaker%'

-- Calendly:
invitee_email NOT LIKE '%@nomoremondays.io%'
AND invitee_email NOT IN ('jaromir1998@gmail.com', 'marek@sintano.com')
```

---

## 13. Quick Reference: Which Table to Query

| Question | Best Table |
|---|---|
| Webinar funnel performance (any era) | `mart_webinar_events` |
| Ad spend drill-through by campaign/day | `stg_meta_ad_performance_daily` |
| Closer performance metrics | `mart_closer_weekly_performance` |
| Individual call-level data (Era 2+3) | `int_calls_enriched` |
| All Meta ad campaigns raw | `stg_meta_campaigns` |
| GHL registrations with traffic source | `stg_ghl_weekly_webinar_regs` |
| Zoom attendance detail | `stg_zoom_webinar_attendance` |
| Fanbasis/Whop transactions | `stg_fanbasis_sales` |
| Legacy closer metrics (pre-Nov 2025) | `stg_closersheet_metrics_weekly` |
| Pipeline freshness | `mart_refresh_status` |

---

## 14. Common Analysis Patterns

### Weekly funnel overview
```sql
SELECT webinar_date, webinar_day, data_era,
       total_webinar_ad_spend, webinar_reg_ad_spend, webinar_hammer_them_ad_spend,
       total_registrants, meta_registrants, unique_attendees, calls_booked,
       calls_held, deals_closed, cash_collected, roas_cash, cac, paid_cpr
FROM `no-more-mondays-analytics.dbt_tuddin.mart_webinar_events`
ORDER BY webinar_date DESC
```

### Closer funnel breakdown (correct formulas)
```sql
SELECT
  closer_owner,
  COUNTIF(is_show_rate_eligible)                          AS calls_on_calendar,
  COUNTIF(is_show_up)                                     AS show_ups,
  COUNTIF(is_close_rate_eligible)                         AS qualified_show_ups,
  COUNTIF(is_deal)                                        AS deals_closed,
  SAFE_DIVIDE(
    COUNTIF(is_show_up),
    COUNTIF(is_show_rate_eligible)
  ) AS show_rate,
  SAFE_DIVIDE(
    COUNTIF(is_close_rate_eligible AND is_deal),
    COUNTIF(is_close_rate_eligible)
  ) AS close_rate,
  -- Breakdown counts
  COUNTIF(call_outcome = 'Setter DQ')   AS setter_dq,
  COUNTIF(call_outcome = 'Closer DQ')   AS closer_dq,
  COUNTIF(is_ghosted)                   AS ghosted,
  COUNTIF(is_canceled)                  AS canceled,
  COUNTIF(is_rescheduled)               AS rescheduled
FROM `no-more-mondays-analytics.dbt_tuddin.int_calls_enriched`
GROUP BY 1
ORDER BY calls_on_calendar DESC
```

### Not-taken breakdown
```sql
SELECT not_taken_category, COUNT(*) AS cnt
FROM `no-more-mondays-analytics.dbt_tuddin.int_calls_enriched`
WHERE not_taken_category IS NOT NULL
GROUP BY 1
ORDER BY cnt DESC
```

### Sales cycle analysis
```sql
-- booking_to_close_days: use for OCC only (webinar funnel speed)
-- first_call_to_close_days: use for FUC only (follow-up cycle length)
-- Always use MEDIAN — mean is skewed by long-tail outliers
SELECT
  closer_owner,
  close_type,
  APPROX_QUANTILES(booking_to_close_days, 2)[OFFSET(1)]     AS median_booking_to_close,   -- OCC: ~2 days
  APPROX_QUANTILES(first_call_to_close_days, 2)[OFFSET(1)]  AS median_first_call_to_close, -- FUC: ~21 days
  COUNT(*) AS deals
FROM `no-more-mondays-analytics.dbt_tuddin.int_calls_enriched`
WHERE is_deal = TRUE AND close_type IS NOT NULL
GROUP BY 1, 2
ORDER BY 1, 2
```

### Ad performance by webinar
```sql
SELECT webinar_date, webinar_type, campaign_name,
       SUM(spend_usd) AS spend, SUM(impressions) AS impressions,
       SUM(conversions) AS conversions,
       SAFE_DIVIDE(SUM(spend_usd), SUM(conversions)) AS cpl
FROM `no-more-mondays-analytics.dbt_tuddin.stg_meta_ad_performance_daily`
GROUP BY 1,2,3
ORDER BY webinar_date DESC, spend DESC
```
