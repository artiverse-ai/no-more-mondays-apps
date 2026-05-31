# Warehouse Map (LLM-Internal Reference)

This file is for **Claude's eyes**, not the user. Use it to translate
business questions into the right tables, joins, and filters. Do not paste
this content into the chat. Do not show table or column names to the user.

**Project:** `no-more-mondays-analytics`
**Primary analytics dataset:** `dbt_tuddin`
**Always fully-qualify:** `` `no-more-mondays-analytics.dbt_tuddin.<table>` ``

---

## The funnel, end to end

```
   Source             Raw dataset              Staging / intermediate          Mart (analytics-ready)
─────────────────────────────────────────────────────────────────────────────────────────────────────
   Meta Ads      →  raw_meta_facebook_ads  +  stg_meta_campaigns          →  mart_webinar_events
                    raw_meta_2_reports        stg_meta_ad_performance_daily   mart_high_level_daily
                    raw_meta.basic_campaign
                    raw_meta_2.basic_campaign

   GoHighLevel   →  raw_ghl.registrations_*  → stg_ghl_weekly_webinar_regs    →  int_funnel_webinar_core
                    raw_ghl.contacts           stg_ghl_monthly_webinar_regs        ↑ joins to ad spend,
                    raw_ghl.opportunities      stg_ghl_form_submissions_flat        Zoom, Calendly
                    raw_ghl.notes
                    raw_ghl.custom_fields_contact

   Zoom          →  raw_zoom.webinar_participant → stg_zoom_webinar_attendance →  (feeds the marts)

   Calendly      →  raw_calendly.*           →  stg_calendly                  →  (feeds int_calls_enriched)

   Airtable      →  raw_airtable_*           →  stg_airtable_sales_calls      →  int_calls_enriched
   (closing calls)                                                                ★ source of truth for
                                                                                  call outcomes + cash

   Fanbasis      →  raw_fanbasis             →  stg_fanbasis_sales            →  mart_high_level_daily
   (payments)                                                                     (canonical bank cash)

   Closersheet   →  raw_closersheet          →  stg_closersheet_metrics_weekly  (FROZEN, pre-Nov 2025 only)
   (legacy)
```

---

## Sources and what they each represent

### Meta Ads (Facebook + Instagram)

Two ad accounts; they're unioned at March 4, 2026 in `stg_meta_campaigns`:

- **Old account:** `raw_meta_facebook_ads.facebook_ads__campaign_report`
  — May 2025 → March 9, 2026.
- **New account:** `raw_meta_2_reports.facebook_ads__campaign_report`
  — March 4, 2026 → present.

For link clicks / reach / frequency (not in the campaign report), join to:
- `raw_meta.basic_campaign` (old account)
- `raw_meta_2.basic_campaign` (new account)
on `(campaign_id, date)`.

`stg_meta_campaigns` columns to know: `campaign_id` (INTEGER),
`campaign_name` (STRING), `account_era` (`'old_account'` / `'new_account'`),
`date_day`, `week_sun`, `spend_usd`, `impressions`, `clicks`, `link_clicks`,
`conversions`, `reach`, `frequency`, `cpc_usd`, `cpm_usd`, `ctr`,
`link_ctr`, `cvr`, `roas`. Grain: campaign-day.

**To join GHL utm_campaign to stg_meta_campaigns:** GHL's `utm_campaign`
is STRING; `stg_meta_campaigns.campaign_id` is INTEGER. Use
`SAFE_CAST(utm_campaign AS INT64) = campaign_id`.

**For ad-set or ad-level breakdown:** there's no staging model. Use the
raw Fivetran tables directly:
- `raw_meta_2_reports.facebook_ads__ad_report` (new account)
- `raw_meta_facebook_ads.facebook_ads__ad_report` (old account)

They carry `ad_id`, `ad_name`, `ad_set_id`, `ad_set_name`, `campaign_id`,
`campaign_name`, daily metrics. **But the GHL → ad-level join is
unreliable** — GHL only carries campaign_id via utm_campaign; utm_content/
utm_term sometimes carry ad info but the convention isn't consistent. See
`caveats.md` "Ad-Level Attribution".

**Spend bucketing** (from `stg_meta_campaigns.campaign_category`):
- `webinar_registration` — drives weekly webinar registrations
- `webinar_hammer_them` — retargets webinar registrants
- `monthly_workshop_registration` — drives Monthly Lump Sum
- `monthly_workshop_hammer_them` — retargets monthly workshop
- `hammer_them_booked_calls` — book-a-call retargeting (NOT a webinar
  campaign — exclude when scoping to the webinar funnel)
- `other`

### GoHighLevel (GHL) — lead capture + CRM

Form submissions, not contact tags, are how we count registrations. Four
registration tables:

| Table | Meaning |
|---|---|
| `raw_ghl.registrations_weekly_webinar` | Weekly Freedom Creator Workshop (Sunday + Wednesday) — Meta, ManyChat, organic |
| `raw_ghl.registrations_weekly_webinar_tiktok` | Weekly webinar from TikTok |
| `raw_ghl.registrations_monthly_workshop` | Monthly Lump Sum — **never union with weekly** |
| `raw_ghl.registrations_monthly_workshop_tiktok` | Monthly Lump Sum from TikTok |

Use `stg_ghl_weekly_webinar_regs` (unifies weekly + TikTok with traffic
source classified) and `stg_ghl_monthly_webinar_regs`. **Do not** mix
weekly with monthly in a single result.

**Traffic source classification** (from `others` JSON → `eventData.url_params`):

| Condition | Traffic source |
|---|---|
| `utm_medium='paid'` AND `utm_source IN ('fb','ig','an')` | **`meta`** |
| Came from TikTok table | **`tiktok`** |
| `organic_source='manychat'` (even with paid UTMs) | **`manychat`** |
| `utm_source='hoobe'` | **`organic_social`** |
| Otherwise | **`direct_or_unknown`** |

**Setter ref tags** (also in `url_params`):
- `ref=swp` → Swapnil
- `ref=hna` → Hania
- `ref=sal` → Salony
(Anything matching `ref=<setter>` indicates a setter-sent registration
link. See user memory `setter-ref-params` if more setters get added.)

**Other GHL tables you'll use occasionally:**
- `raw_ghl.contacts` — look up a person by email/phone. Has `tags` (JSON
  array; **rich journey signal** — see `caveats.md` "GHL Contact Tags"),
  `source`, `assigned_to`, `attribution_source` (always NULL — skip),
  `date_added`, `date_updated`.
- `raw_ghl.contact_tags` — normalized (`contact_id`, `tag`) rows; use for
  cross-contact tag queries ("everyone tagged ManyChat") instead of
  scanning the JSON.
- `raw_ghl.opportunities` — pipeline / stage info.
- `raw_ghl.notes` — call/text notes setters/closers add.
- `raw_ghl.custom_fields_contact` — extra contact metadata (e.g. setter
  owner stamps).

**Raw form-submission tables (use when the cleaned staging mislabels):**

The staging `traffic_source` classification drops Meta arrivals that
carry only an `fbclid` (no UTMs) — about 12% of weekly "direct" regs are
really Meta. For per-customer journey questions, you may need to read the
raw form-submission `others` JSON directly:

| Raw table | When to use |
|---|---|
| `raw_ghl.registrations_weekly_webinar` | Weekly webinar registrations — has full url_params JSON |
| `raw_ghl.registrations_weekly_webinar_tiktok` | Same shape, TikTok flow |
| `raw_ghl.registrations_monthly_workshop` | Monthly Lump Sum — full url_params JSON |
| `raw_ghl.registrations_monthly_workshop_tiktok` | Same shape, TikTok flow |

Key JSON paths inside the `others` column:

```sql
JSON_EXTRACT_SCALAR(others, '$.eventData.url_params.fbclid')       AS fbclid
JSON_EXTRACT_SCALAR(others, '$.eventData.url_params.utm_source')   AS utm_source
JSON_EXTRACT_SCALAR(others, '$.eventData.url_params.utm_medium')   AS utm_medium
JSON_EXTRACT_SCALAR(others, '$.eventData.url_params.utm_campaign') AS utm_campaign
JSON_EXTRACT_SCALAR(others, '$.eventData.url_params.utm_content')  AS utm_content
JSON_EXTRACT_SCALAR(others, '$.eventData.url_params.utm_term')     AS utm_term
JSON_EXTRACT_SCALAR(others, '$.eventData.keyword')                 AS keyword
JSON_EXTRACT_SCALAR(others, '$.eventData.source')                  AS source_label
JSON_EXTRACT_SCALAR(others, '$.eventData.referrer')                AS referrer
```

Join back to a contact via `r.contactId = contacts.id` (note: `contactId`
camelCase in raw — different from the staging tables' `contact_id`).

### Zoom — webinar attendance

- `raw_zoom.webinar_participant` — every join (a contact may have multiple
  rows if they dropped + rejoined). **Deduplicate by email**; sum
  `duration_minutes` across rows. Stay on the non-deleted session
  (`_fivetran_deleted = false`) when both exist, **except** when only a
  deleted row exists (rescheduled webinar — that's ground truth).
- `stg_zoom_webinar_attendance` — pre-deduplicated; preferred unless you
  need raw join granularity.
- `pitched_attendees` = total duration > 25 minutes per contact.

**Always exclude internal staff** — see `caveats.md`.

### Calendly — call bookings

- `raw_calendly.*` — raw event/invitee data.
- `stg_calendly` — cleaned VIEW (note: VIEW, so won't appear in
  INFORMATION_SCHEMA.PARTITIONS). Has `internal_note` as source of truth
  for which webinar a booking came from:

| internal_note (lowercase) | Webinar |
|---|---|
| `'live webinar'` | Sunday |
| `'wednesday webinar'` | Wednesday |
| `'post-attendee webinar typeform'` | Either — use the booking's created_date promo window |
| `'live webinar - typeform'` | Legacy label — same as above |

**Pre-computed boolean flags on `stg_calendly`** — prefer these over
re-implementing the logic:

| Flag | Meaning |
|---|---|
| `is_webinar_booking` | TRUE for the four internal_note values above (includes typeforms) |
| `is_setter_booking` | TRUE when `internal_note LIKE '%setter%'` |
| `is_canceled` | TRUE when status='canceled' OR canceled_by IS NOT NULL OR invitee_status='canceled' |
| `is_affiliate_booking`, `is_website_booking`, `is_skool_booking`, `is_lead_magnet_booking` | self-explanatory |

**Other useful columns:**
- `calendly_flow_type` — friendly label: `'Sunday Webinar'`, `'Wednesday
  Webinar'`, `'Post-Attendee Typeform'`, `'Setter Booked'`, etc.
- `setter_name` — extracted setter from internal_note when it's a setter
  booking
- `assigned_rep_name`, `assigned_rep_email` — the closer assigned to the
  call
- `event_name` — user-facing name (sales calls contain `"strategy"`)

**Sales calls definition** — there are two:
- Broad: `LOWER(event_name) LIKE '%strategy%'` (this is what
  `mart_high_level_daily.total_calls_booked` uses)
- Webinar-funnel-only: `is_webinar_booking = TRUE`

Use the broad one for "calls booked" rolled-up numbers to match dashboards.
Use the webinar-only one when scoping to a specific webinar's calls.

**Always exclude internal staff** — see `caveats.md`.

### Airtable — closing call outcomes (★ source of truth since Nov 2025)

- `raw_airtable_*` — raw sync.
- `stg_airtable_sales_calls` — staging.
- **`int_calls_enriched`** — **this is the source of truth** for every
  outcome that depends on what happened on the call. Use it for:
  - Whether a call was held (`is_show_up`)
  - Whether it became a deal (`is_deal`)
  - Cash collected on the call (`cash_collected`)
  - Revenue / contract value (`revenue_generated`)
  - Setter / closer attribution (`setter_owner`, `closer_owner`)
  - Loss reasons (`dq_reason`, `loss_reason_display`)
  - Disposition state (`is_dispositioned`, `not_taken_category`)

**Important date columns:**
- `appointment_date_time` — **overridden for deals** to `date_closed`
  (puts them in the correct sales week). Use for **funnel-stage rollups
  by week**. Do NOT use as a "scheduled-for" timestamp.
- `call_date_time` — the **raw, unadjusted** appointment time. Use this
  when you actually need to know when a call was scheduled.
- `calendly_created_ts` — when the prospect booked the call (the real
  booking timestamp). NULL for ~2.4% of rows (Airtable record didn't link
  to a Calendly event). When computing sales cycle, filter `WHERE
  calendly_created_ts IS NOT NULL` and report the included sample size.
- `date_closed` — when the deal closed (NULL if not a deal).
- `created_date` — Fivetran sync time, **NOT the booking date.** Don't
  confuse with `calendly_created_ts`.
- `booking_week_sun` — Sunday-anchored week the call was *booked*. Never
  changes. Use this when attributing back to a webinar week.
- `held_week_sun`, `deal_week_sun` — Sunday-anchored weeks for held / deal.

**Eligibility flags for canonical rates:**
- `is_show_up` — call was actually held (excludes Setter DQ — Airtable's
  `is_call_held` falsely flags Setter DQ as TRUE; **never use
  `is_call_held` or `is_held`**, both removed 2026-05-16)
- `is_show_rate_eligible` — denominator for show rate (excludes
  rescheduled calls)
- `is_close_rate_eligible` — denominator for close rate (excludes Setter
  DQ AND Closer DQ)
- `call_status_category` — pre-rolled-up Looker dimension; non-NULL for
  every row. Use this for high-level breakdowns rather than raw
  `call_outcome` / `not_taken_category`.

**Close-type column** (for sales-cycle medians):
- `close_type IN ('OCC', 'FUC')` — One-Call-Close vs Follow-Up-Close
- `booking_to_close_days` (only meaningful for OCC; NULL when
  `calendly_created_ts IS NULL`)
- `first_call_to_close_days` (only meaningful for FUC)

**`final_marketing_flow`** routes a call back to its origin:

| Value | Meaning |
|---|---|
| `'Webinar'` | Sunday Freedom Creator Workshop |
| `'Wednesday Webinar'` | Wednesday Freedom Creator Workshop |
| `'Post-Attendee Webinar Typeform'` | Typeform — use `booking_week_sun` + booking window |
| `'Setter Booked'`, `'Lead Magnet'`, `'Skool'`, `'From Website'`, `'Creator Agreement'`, … | Non-webinar — exclude when scoping to webinar funnel |

### Fanbasis — payments (canonical cash)

- `raw_fanbasis` → `stg_fanbasis_sales`.
- Used in `mart_high_level_daily.total_cash_collected_fanbasis` (and there's
  a Whop variant). Cash here is what hit the payment processor — closer to
  banked cash than Airtable's `cash_collected`, but **still not the same as
  banked cash** (Payva holds back funds). See `caveats.md`.

### Legacy (frozen, pre-Nov 2025 only)

- `raw_closersheet` → `stg_closersheet_metrics_weekly` → 
  `int_funnel_webinar_legacy`. Don't query these unless the user asks
  explicitly about pre-Nov 2025 data.

---

## The marts (analytics-ready)

Use these for most aggregate questions. They're already joined, attributed,
and have caveats baked in.

### `mart_webinar_events` — webinar grain (one row per webinar)

- Grain: `webinar_date` (the date the webinar ran).
- Webinar types: `webinar_day IN ('Sunday', 'Wednesday', 'Monthly Workshop')`.
- **Monthly Workshop replaces the Sunday webinar that week** — Monthly
  always runs on a Sunday, and no `Sunday` row exists in the same week.
  See `caveats.md` "Monthly Lump Sum Workshop REPLACES The Sunday Webinar."
- ~62 columns. Spec at `docs/mart_webinar_events_spec.md` in the repo.

**Top-of-funnel (registrations):**
- `total_registrants`, `lp_page_views`, `lp_opt_ins`, `lp_opt_in_rate`,
  `lp_form_submissions`
- Source breakdown (NULL for pre-2026 Legacy rows): `meta_registrants`,
  `tiktok_registrants`, `manychat_registrants`, `setter_registrants`,
  `other_organic_registrants`
- Era 3 (after 2026-04-18): `tier_form_submissions` (creators
  pre-workshop tier form), `tier_one_submissions` (subset with
  `financial_tier='tier_1'` — the "% Tier 1 Leads" KPI denominator)

**Attendance:**
- `unique_attendees` — deduplicated by email
- `pitched_attendees` — subset with Zoom duration > 25 min
- `reg_to_attend_rate` = `unique_attendees / total_registrants`
- `attend_to_pitched_rate` = `pitched_attendees / unique_attendees`

**Sales outcomes (anchored on `booking_week_sun`):**
- `calls_booked_active` (re-evaluated each run; excludes canceled)
- `shows` (was `calls_held`; uses `is_show_up`, **NOT** `is_call_held` —
  see `caveats.md` Setter DQ bug)
- `qualified_shows` = `COUNTIF(is_close_rate_eligible)` (excludes Setter
  DQ + Closer DQ)
- `webinar_deposits`, `deals_closed` (kept for backward compat)
- `cash_collected`, `revenue_generated`, `revenue_predicted` (projected
  for payment plans), `deposit_collected`

**Reactivations (NULL when `is_reactivation_data_available = FALSE` —
that's TRUE only for webinars after no-show tagging began):**
- `reactivation_pool_size`, `reactivations_attended`, `reactivations_booked`
- Source: `int_webinar_reactivations` — a prior no-show contact whose next
  webinar attendance is this one

**Ratios (per-attendee):**
- `cash_collected_per_attendee`, `contract_value_per_attendee`
- `pitch_to_book_rate`, `reg_to_book_rate`

**Ad spend (always split 3 ways):**
- `webinar_reg_ad_spend` — paid registration campaigns
- `webinar_hammer_them_ad_spend` — webinar retargeting
- `total_webinar_ad_spend` = sum of the two above
- (The book-a-call "hammer them" retargeting campaign has no "webinar" in
  its name and is excluded entirely — it shouldn't appear here.)

**Derived CEO metrics:**
- `paid_cpr` = `webinar_reg_ad_spend / meta_registrants` — the true paid
  cost per registration
- `blended_cpa` = `total_webinar_ad_spend / unique_attendees`
- `blended_cpbc_active` = `total_webinar_ad_spend / calls_booked_active`
  (non-canceled only)
- `blended_cost_per_show` = `total_webinar_ad_spend / shows` (was
  `blended_cost_per_held_call`)
- `blended_cost_per_qualified_show` = `total_webinar_ad_spend /
  qualified_shows` — added 2026-05-13
- `roas_revenue` = `revenue_generated / total_webinar_ad_spend`
- `roas_cash_running` — LIVE Fanbasis-installment-aware ROAS that grows
  over time as payment plans post. NULL for legacy rows.
- (`blended_cpr` was REMOVED — use `paid_cpr` instead.)

**Meta funnel metrics (REGISTRATION campaigns only):**
- `meta_impressions`, `meta_link_clicks` (link clicks, not all clicks),
  `meta_reported_conversions`
- `meta_ctr` = `meta_link_clicks / meta_impressions`
- `meta_cvr` = `meta_reported_conversions / meta_link_clicks`
- `meta_cpl` = `webinar_reg_ad_spend / meta_reported_conversions`
- `frequency_webinar_hammer_them` — APPROXIMATE: `SUM(impressions) /
  MAX(daily_reach)` over the window. NULL when no reach data.

**Ad-spend attribution rule:** Sunday webinar gets Thu + Fri + Sat + ½·Sun
(+ the prior Mon–Wed when no Wednesday webinar that week). Wednesday
webinar gets ½·Sun + Mon + Tue + Wed. The mart applies this dynamically —
adding a Wednesday webinar retroactively re-routes the Mon–Wed spend.
**Don't redo this attribution in queries.**

**NULL behavior to know:**
- Legacy rows (pre-2025-11-23): NULL on registrations breakdown, Meta
  breakdown, reactivations, `calls_booked_active`, `qualified_shows`,
  `roas_cash_running`.
- Reactivations: FALSE if tagging hadn't started for that webinar.
- In-progress webinars: downstream sales metrics are partial — flag
  partial-data status to the user when reporting.

**What's NOT in this mart (must compute from `int_calls_enriched`):**
- Calls show rate (per-call denominator), close rate
- Per-closer / per-setter funnels
- Sales-cycle medians (OCC ~2 days, FUC ~21 days)

`mart_funnel_webinar_performance` is a deprecated VIEW (filters
Sunday + Monthly only, excludes Wednesday) — migrate legacy Looker tiles
to `mart_webinar_events` directly.

### `mart_high_level_daily` — CEO dashboard (one row per calendar date)

- Grain: `metric_date` (DATE, zero-filled from 2025-05-01 to today).
- **Three** date-keys (not two — I was wrong before):
  - Marketing-side (cash-Airtable, revenue, deals, PIF rate) →
    `date_closed`.
  - Funnel-stage (calls booked, shows, dispositioned, DQ counts) →
    `appointment_date_time::date`.
  - Bank-receipt cash (Fanbasis only) → `stg_fanbasis_sales.sale_date`.

**The mart stores numerators + denominators separately** so Looker can sum
any period and compute rates from the sums. Don't average pre-computed
rates across days — sum the counts and recompute. Rate pairs available:

| Rate | Numerator | Denominator |
|---|---|---|
| Show rate | `count_show_ups` | `count_show_rate_eligible` |
| Close rate (on shows) | `count_deals_attended` | `count_show_ups` |
| Close rate (closer-qualified) | `count_deals_attended` | `count_close_rate_eligible` |
| Setter DQ rate | `count_setter_dq` | `count_prospects_dispositioned` |
| Closer DQ rate | `count_closer_dq` | `count_show_ups` |
| PIF rate | `count_pif_deals` | `total_deals_closed` |

**Key sum columns:**
- `total_calls_booked` — Calendly, filters `event_name LIKE '%strategy%'`
  (broad sales-call definition, matches dashboards)
- `total_cash_collected` — Airtable closer-reported (use for AOV / ACV /
  DPC / per-closer attribution)
- `total_cash_collected_fanbasis` — bank truth, includes payment-plan
  installments + renewals (use for Cash Collected headline + ROAS-Cash-
  Fanbasis ONLY — see `caveats.md`)
- `total_revenue_contracted` (**not** `total_revenue_generated`)
- `total_deals_closed`, `total_pif_deals`
- `total_ad_spend` — ALL Meta campaigns, not just webinar

**Sales-cycle medians are NOT in this mart.** Compute them on the fly from
`int_calls_enriched` per the user's range:
- OCC cycle: median `booking_to_close_days` WHERE `close_type='OCC'`
- FUC cycle: median `first_call_to_close_days` WHERE `close_type='FUC'`

**Cost Per Booked Call caveat:** Spend → registration → webinar → booking
has a multi-day lag. Use this mart for **weekly or monthly grain only,
never daily** — the first and last few days of any range distort CPBC
because of how the lag concentrates. The Looker dashboards roll up to
week / month grain for exactly this reason.

### `mart_funnel_webinar_performance` (VIEW)

A view over `mart_webinar_events` filtered to
`webinar_day IN ('Sunday', 'Monthly Workshop')`, with column aliases for
legacy Looker dashboards. Don't query it for new analysis — query
`mart_webinar_events` directly.

### `mart_closer_weekly_performance` — per-closer-per-day

Use this for "who's the top closer this month" / "how is <closer> doing"
questions. Grain: one row per (`appt_date`, `closer_name`).

Key columns:
- `closer_name` (first-name format — clean, unlike `setter_owner`)
- `calls_held`, `unique_calls_held`
- `deals_closed_won`, `cash_collected`, `revenue_generated`
- `avg_revenue_per_deal_acv`, `avg_cash_per_deal_aov`, `avg_days_to_close`
- `show_rate`, `close_rate`, `prospect_to_close_rate`
- `is_legacy_data` (exclude `TRUE` for current-era questions)

When summing across a date range, **sum the numerators and recompute the
rates** — don't average pre-computed rates across days.

### Other marts

- `mart_rep_weekly_performance`, `mart_rep_performance_monthly` — additional
  rep cuts.
- `mart_refresh_status` — when the warehouse last refreshed. Check this if
  the user reports stale numbers.

---

## Customer-journey queries (the marquee use case)

When a user asks "where did this customer come from?" the journey is:

1. **Identify the contact** — by email (preferred), phone, or name. The
   staging registration tables do **not** carry email — they carry
   `contact_id`. To go from email to contact_id, hit `raw_ghl.contacts`:
   ```
   SELECT id AS contact_id
   FROM `no-more-mondays-analytics.raw_ghl.contacts`
   WHERE LOWER(email) = LOWER('<email>')
   ```
   GHL is inconsistent with case — always `LOWER(email)`.
2. **Find the GHL registration(s)** by contact_id — and check **both**
   weekly and monthly tables (a single customer can cross funnels):
   ```
   SELECT 'weekly' AS funnel, contact_id, created_date, traffic_source,
          utm_source, utm_campaign, ref_param, attributed_webinar_date
   FROM `no-more-mondays-analytics.dbt_tuddin.stg_ghl_weekly_webinar_regs`
   WHERE contact_id = '<id>'
   UNION ALL
   SELECT 'monthly', contact_id, created_date, traffic_source,
          utm_source, utm_campaign, ref_param, CAST(NULL AS DATE)
   FROM `no-more-mondays-analytics.dbt_tuddin.stg_ghl_monthly_webinar_regs`
   WHERE contact_id = '<id>'
   ORDER BY created_date
   ```
   Columns to know on these staging tables: `created_date` (DATE — not
   `created_at`), `traffic_source`, `utm_source`, `utm_campaign`,
   `ref_param`, `registration_type`, `attributed_webinar_date` (already
   applies the promo-window attribution rule — use it instead of recomputing).
3. **If `traffic_source = 'meta'`**, the UTM params (typically
   `utm_campaign`, `utm_content`, `utm_term`) tell you which Meta campaign
   / ad set / ad. `utm_campaign` is usually a numeric campaign ID — join to
   `stg_meta_campaigns` on campaign_id to get the campaign name, ad set,
   and spend.
4. **If `traffic_source = 'manychat'`**, that's all we know today. (Future:
   ManyChat data will let you see the funnel + keyword. See "Future"
   section.)
5. **Webinar attendance:**
   ```
   SELECT webinar_id, join_time, duration_minutes
   FROM stg_zoom_webinar_attendance
   WHERE LOWER(user_email) = LOWER('<email>')
   ```
6. **Calendly bookings:**
   ```
   SELECT created_at, event_name, internal_note, scheduled_event_start_time
   FROM stg_calendly
   WHERE LOWER(invitee_email) = LOWER('<email>')
   ```
7. **Call outcomes + revenue:**
   ```
   SELECT appointment_date_time, final_marketing_flow, setter_owner,
          closer_owner, is_show_up, is_deal, cash_collected, revenue_generated
   FROM int_calls_enriched
   WHERE LOWER(prospect_email_lc) = LOWER('<email>')
   ORDER BY appointment_date_time
   ```

Tell the user the story: "They first registered for the May 17 Sunday
webinar through a Meta ad called <ad name>, didn't attend live, came back
and registered for May 24, attended for 51 minutes, booked a call with
<setter>, was held by <closer>, closed for $5,997."

---

## Future — ManyChat (not yet in warehouse)

ManyChat data is **not in BigQuery yet** but the integration is planned.
When it arrives, expect roughly this shape (subject to change):

- A `raw_manychat.*` (or similar) dataset.
- One row per ManyChat conversation / subscriber.
- Fields: subscriber_id, funnel_id, funnel_name, keyword_triggered,
  setter_assigned, conversation_started_at, hand-off-to-call timestamp,
  ...
- Should be joinable to GHL by phone (most reliable) or email.

Until then: if a user asks "which ManyChat funnel did this person come
from?", tell them ManyChat funnel attribution isn't in the warehouse yet
but will be added. You can still tell them whether the person came in via
ManyChat at all (via `traffic_source = 'manychat'`).

---

## Reading vs writing

This skill is **read-only**. Even if you're confident a query is safe,
use the SELECT-only / read-only variant of the BigQuery connector tool.
Never run `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `DROP`, or `MERGE`.

If a user asks you to fix bad data ("can you correct this row?"),
**don't** — tell them that's a job for the data engineering team. Surface
it in `#growth-ops` Slack.
