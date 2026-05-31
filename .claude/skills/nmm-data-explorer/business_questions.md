# Business Questions — Patterns and Answers

This file is for **Claude's eyes**. It catalogs the most common questions
leadership / ops asks, with the approach for each. Use it before writing
SQL from scratch — pattern-match first.

For data-model details (table names, column meanings, join keys), see
`data_model.md`. For caveats on every number, see `caveats.md`.

---

## 1. "Where did this customer come from?" / "Trace the journey for <email>."

The marquee question. Full chain: registration → ad → tags → attendance →
booking → call outcome → cash.

**The cleaned tables alone are not enough.** They drop attribution signals
(fbclid-only Meta clicks) and miss tag-based context (ManyChat involvement,
product purchased, setter pod). For per-customer journeys, **always
descend into the raw layer** — see steps 3 and 5 below.

**Steps:**

1. **Identify the contact** in GHL. Look up by `LOWER(email)`:
   ```sql
   SELECT id AS contact_id, email, source, tags, date_added
   FROM `no-more-mondays-analytics.raw_ghl.contacts`
   WHERE LOWER(email) = LOWER('<email>')
   ```
   Watch for duplicates — GHL routinely produces two records for the
   same person (one with email + activity, one empty stub). Mention them
   to the user as a housekeeping note.

2. **Find registrations across all 4 forms** (weekly + monthly, each with
   a TikTok sibling). Use `contact_id`, not email — the staging tables
   carry contact_id only:
   ```sql
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
   Sort by `created_date` — the earliest is the first touch.

3. **If `traffic_source = 'direct_or_unknown'` or `'organic_social'`, do
   NOT stop there.** Pull the raw `others` JSON and check for an fbclid
   — see `caveats.md` "Cleaned `traffic_source` Under-Counts Meta":
   ```sql
   SELECT
     JSON_EXTRACT_SCALAR(others, '$.eventData.url_params.fbclid')       AS fbclid,
     JSON_EXTRACT_SCALAR(others, '$.eventData.url_params.utm_source')   AS utm_source,
     JSON_EXTRACT_SCALAR(others, '$.eventData.url_params.utm_campaign') AS utm_campaign,
     JSON_EXTRACT_SCALAR(others, '$.eventData.url_params.utm_content')  AS utm_content,
     JSON_EXTRACT_SCALAR(others, '$.eventData.keyword')                 AS keyword,
     JSON_EXTRACT_SCALAR(others, '$.eventData.source')                  AS source_label,
     JSON_EXTRACT_SCALAR(others, '$.eventData.referrer')                AS referrer
   FROM `no-more-mondays-analytics.raw_ghl.registrations_weekly_webinar`
   WHERE contactId = '<id>'   -- camelCase in raw layer
   ```
   Repeat for `raw_ghl.registrations_monthly_workshop` and the TikTok
   siblings if needed.
   - `fbclid IS NOT NULL` → confirmed Meta click, even if the cleaned
     feed said direct.
   - `utm_campaign IS NOT NULL` → can join to `stg_meta_campaigns` to
     name the campaign. Without it, you can confirm "from Meta" but not
     which campaign / ad.

4. **If the registration is for the Monthly Workshop**, check whether the
   Sunday in question was actually a Monthly Workshop event:
   ```sql
   SELECT webinar_day FROM `no-more-mondays-analytics.dbt_tuddin.mart_webinar_events`
   WHERE webinar_date = '<date>'
   ```
   If `'Monthly Workshop'`, name the event accordingly — there was no
   separate Sunday webinar that week. See `caveats.md` "Monthly Lump Sum
   Workshop REPLACES The Sunday Webinar."

5. **Pull the contact's tags** — this is the richest single signal and
   often answers questions the structured tables don't:
   ```sql
   SELECT TO_JSON_STRING(tags) AS tags
   FROM `no-more-mondays-analytics.raw_ghl.contacts`
   WHERE id = '<id>'
   ```
   Look for: `manychat*` (ManyChat involvement), `event: webinar-<date>`
   vs `event: workshop-<date>` (which event they actually attended),
   `ws<N>-a` / `ws<N>-b` (setter assignment), `vip accelerator purchased`
   / `inner circle member` (product flags), `status: won` /
   `status: refunded` (outcome). See `caveats.md` "GHL Contact Tags."

6. **Webinar attendance** from Zoom (already deduplicated, staff
   excluded):
   ```sql
   SELECT webinar_date, total_duration_seconds, is_pitched_attendee
   FROM `no-more-mondays-analytics.dbt_tuddin.stg_zoom_webinar_attendance`
   WHERE LOWER(attendee_email) = LOWER('<email>')
   ORDER BY webinar_date
   ```

7. **Calendly bookings:**
   ```sql
   SELECT event_created_at, event_name, internal_note, calendly_flow_type,
          assigned_rep_name, is_canceled, start_time
   FROM `no-more-mondays-analytics.dbt_tuddin.stg_calendly`
   WHERE LOWER(invitee_email) = LOWER('<email>')
   ORDER BY event_created_at
   ```

8. **Call outcomes + revenue:**
   ```sql
   SELECT appointment_date_time, call_date_time, final_marketing_flow,
          setter_owner, closer_owner, call_status_category,
          is_show_up, is_deal, cash_collected, revenue_generated, close_type
   FROM `no-more-mondays-analytics.dbt_tuddin.int_calls_enriched`
   WHERE prospect_email_lc = LOWER('<email>')
   ORDER BY appointment_date_time
   ```
   - If GHL tags show `status: won` but Airtable rows are open → apply
     the dispositioning-lag caveat ("CRM shows a close; closer hasn't
     logged the deal yet — usually populates within 24–72h").
   - For "when did the call happen," prefer `call_date_time` over
     `appointment_date_time` (the latter is overridden for closed deals
     — see `caveats.md`).

9. **Tell the story chronologically in plain language.** Use the
   people's names (closer, setter). Use the correct event name (Monthly
   Workshop vs Sunday Webinar — check step 4). Don't paste SQL or table
   names. State attribution honestly: if you fell back to fbclid, say
   "confirmed Meta click but no specific campaign tagged."

**Sample reply shape (fbclid-only Meta attribution, Monthly Workshop close):**

> Dillon Boothe (dtboothe1@yahoo.com) came in from a **Meta ad click on
> May 20** — confirmed via the Facebook click ID on his registration,
> though the campaign UTMs weren't tagged so I can't name the specific
> ad. He registered for your **Monthly Lump Sum Workshop** that ran on
> Sunday May 24 (the Monthly replaces the regular Sunday webinar that
> week). He attended live for about 2h 43m — fully engaged through the
> pitch — then booked a call with **Grace**, who closed him on the VIP
> Accelerator (his GHL tags show `status: won`, `vip accelerator
> purchased`, `inner circle member`, `webinar occ`). The Airtable
> closing-call record is still open — that's normal at 2–3 days out and
> should be dispositioned within the next day or two.
>
> Housekeeping: there are two GHL records under his name. Worth merging.

---

## 2. "How many leads did <campaign / ad / ad set> bring in last week?"

**Steps:**
1. Identify the campaign / ad set / ad name and date range.
2. Query `stg_meta_campaigns` for the matching campaigns + date range to get
   spend, impressions, link clicks, conversions (Meta-reported).
3. Cross-check by querying `stg_ghl_weekly_webinar_regs` filtered to the
   same UTM (campaign id / name) and date range — this is the "true"
   registration count (Meta-reported conversions can lag or overcount).
4. Report both numbers. The GHL number is the one you should anchor on; the
   Meta number is reference for the ads team.

**Note:** the "webinar_hammer_them" campaign category drives webinar
registrations too (retargeting); don't exclude it when asked about webinar
lead volume.

---

## 3. "Which webinar had the highest close rate?"

**Steps:**
1. Query `mart_webinar_events` for the requested period.
2. Close rate is computed: `SAFE_DIVIDE(deals, shows)`. The mart may already
   have it; if not, derive.
3. Filter by `webinar_day` if the user specified Sunday / Wednesday /
   Monthly Workshop. Do **not** mix Monthly Workshop with weekly.
4. Caveat: the most recent webinar(s) likely have incomplete dispositioning
   — see `caveats.md`. Flag this if the user's date range includes the
   current week.

---

## 4. "How is <setter> doing this week?"

**Steps:**
1. Use **fuzzy** match on `setter_owner` — the data is messy. See
   `caveats.md` "setter_owner Data Is Messy". Pattern:
   ```sql
   WHERE LOWER(setter_owner) LIKE '%<first_name>%'
      OR LOWER(setter_owner) LIKE '%ws<N>%'   -- only if you know their WS#
   ```
2. Group by the literal `setter_owner` string so the user sees how their
   calls are split across spellings. Report each variant as its own row.
3. Funnel stages (calls booked, shows, dispositioned, DQ) use
   `appointment_date_time`. Cash and revenue use `date_closed`.
4. Setter Owner conventions (from user memory `setter-owner-format`):
   - **First-name only:** Aviyhon, Hania, Swapnil, Sal, Salony
   - **`Firstname Lastname WS<N>` (WS setters):** Ahmad Yasin WS2, Joel
     Brown WS5, Teddy Seaton WS11, etc.
   - **Misspelling alert:** `Avihyon` and `Aviyhon` are the same person.
5. If you see bare-WS-tag entries (`ws11`, `ws5`), flag them: "I'm also
   seeing N calls tagged just 'ws11' with no name — probably the same
   person but I can't confirm."
6. Report: calls booked, shows, deals, cash collected. Show rate and close
   rate with the dispositioning-lag caveat if the current week is in
   scope.
7. **Don't include calls in the `Webinar Registrant Dialing` pipeline** if
   asked about non-Aviyhon setters (that's Aviyhon's pipeline only — see
   user memory `webinar-registrant-dialing-pipeline`).

---

## 5. "Show me cash collected this week broken down by traffic source."

**Steps:**
1. From `int_calls_enriched`, get all calls where `is_deal = TRUE` and
   `date_closed` in the requested period.
2. To get traffic source for each deal:
   1. Join `LOWER(prospect_email_lc) = LOWER(raw_ghl.contacts.email)` to
      get `contact_id`.
   2. UNION `stg_ghl_weekly_webinar_regs` + `stg_ghl_monthly_webinar_regs`
      (cross-funnel customers exist — see `caveats.md`).
   3. Pick the **earliest** registration per `contact_id` —
      `ROW_NUMBER() OVER (PARTITION BY contact_id ORDER BY created_date)`.
3. Group by `traffic_source`, sum `cash_collected`. **Bucket
   non-matches as `'unknown'`** — about half of deals won't link to a GHL
   contact (email mismatch). See `caveats.md` "Email Match Airtable ↔
   GoHighLevel is Lossy".
4. **Always state two caveats with the result:**
   - Cash collected is Airtable closer-reported, not banked. Payva holdback
     applies. See `caveats.md` "Cash Collected ≠ Banked Cash".
   - The "unknown" bucket exists because some deals' emails don't match
     GHL. Don't hide this — tell the user how many deals fell out.

**Sample reply shape:**

> Last 7 days: 18 deals totaling $40,274 in closer-reported cash. Of those:
> Meta-attributed: 3 deals / $8,494. Direct or unknown traffic: 5 deals /
> $9,494. **8 deals ($22,286) couldn't be linked back to a registration**
> — usually because the email on the closing call differs from the GHL
> contact email. Heads-up: this is closer-reported cash, not banked cash
> (Payva holds back ~65%).

---

## 6. "What's the show rate on Wednesday webinars over the last 4 weeks?"

**Steps:**
1. `mart_webinar_events` filtered to `webinar_day = 'Wednesday'`, last 4
   `webinar_date` values.
2. Show rate = `SAFE_DIVIDE(shows, calls_booked_active)` — confirm against
   mart spec (`docs/mart_webinar_events_spec.md` in repo). The mart may
   already expose a `show_rate` column.
3. If the current week is in the window, flag that the latest row may have
   incomplete dispositioning.

---

## 7. "Who attended the webinar but didn't book a call?"

**Steps:**
1. From `stg_zoom_webinar_attendance` for the target `webinar_date`, get
   all attendees (deduplicated by email, excluding internal staff — see
   `caveats.md`).
2. Anti-join against Calendly bookings for those emails in the booking
   window (Sun night → Tue for Sunday webinars, Wed night → Fri for
   Wednesdays).
3. Return a list with name, email, duration attended.
4. **Don't list more than ~50 unless the user asks.** Default to "287
   attendees did not book — top 10 most engaged below" with the top 10
   sorted by duration.

---

## 8. "How many calls were booked but not held this week, and why?"

**Steps:**
1. `int_calls_enriched` filtered to `appointment_date_time` in the week.
2. Bucket: held vs not-held vs not-yet-dispositioned. Don't conflate the
   second two:
   - `is_show_up = TRUE` → held
   - `is_show_up = FALSE AND is_dispositioned = TRUE` → not held (the
     "why" is in `not_taken_category` / `not_taken_reason`)
   - `is_dispositioned = FALSE` → undispositioned (closer hasn't processed
     yet; not a no-show)
3. For not-held breakdown, group by `not_taken_category`:
   - `'Setter DQ'` (pre-call disqualification by setter) — **never** has a
     `not_taken_reason` (per user memory `setter-dq-no-ntr`). If you see
     "no reason" here, that's correct, not missing data.
   - `'Canceled by Closer'`, `'Canceled by Prospect'`, `'Rescheduled'` —
     reason text is in `not_taken_reason` but is often inconsistent (e.g.
     both "Canceled by Closer" and bare "Canceled" show up for the same
     bucket).
4. Always quote the undispositioned count alongside — e.g. "10 calls were
   booked but didn't hold, plus 15 are still pending dispositioning."

**Sample reply shape:**

> Last 7 days: 266 calls booked. Of those, 147 are dispositioned
> (105 held, 42 didn't hold) and **119 are still pending.** Of the 42
> that didn't hold:
> • Setter DQ (pre-call disqualifications): 33
> • Canceled by Closer: 7
> • Rescheduled: 2
> • Canceled by Prospect: 0
> Heads-up: 45% of this week's calls aren't dispositioned yet, so these
> numbers will shift over the next 24–72 hours.

---

## 9. "Compare this week vs last week" (any metric)

**Steps:**
1. Pull both weeks from the appropriate mart.
2. Compute delta and % change.
3. **Caveat:** if "this week" is in progress (current Sun–Sat partial),
   tell the user it's a partial week — don't compare two full weeks
   against one partial. Either project forward (state the assumption) or
   compare "last week vs the week before" instead.

---

## 10. "Who's the top closer this month by cash / deals / revenue?"

**Steps:**
1. Query `mart_closer_weekly_performance` for the date range — grain is
   per (`appt_date`, `closer_name`). Sum across days.
2. **Never average pre-computed rates across days** — sum the numerators
   (deals, held, cash, revenue) and recompute the rates from the sums.
3. Use first-name `closer_name` directly (this mart is clean — unlike
   `setter_owner`).
4. Exclude `is_legacy_data = TRUE` for current-era questions.
5. Top by: `cash_collected` (cash), `deals_closed_won` (deals),
   `revenue_generated` (contract value).
6. Apply the cash caveat from `caveats.md` if reporting cash.

**Sample reply shape:**

> Top closer this month by cash: **Morgan** — 24 held calls, 7 deals,
> $34,978 closer-reported cash, 29% close rate. **Tyler** leads in deal
> count (13 deals, $44,967 contract value, 48% close rate).

---

## 11. "Which Meta campaign / ad brought the most webinar leads this week?"

**Steps:**
1. From `stg_ghl_weekly_webinar_regs` filtered to `traffic_source = 'meta'`
   and the date window, group by `utm_campaign` (it's a STRING) — count
   regs.
2. Join to `stg_meta_campaigns` to get `campaign_name`, `account_era`,
   `spend_usd`. Cast: `SAFE_CAST(utm_campaign AS INT64) = campaign_id`.
3. Aggregate spend to the same date window so cost-per-reg is meaningful.
4. Report by campaign with name, regs, spend, cost-per-reg.
5. **If the user asks for ad-set or ad breakdown**, see `caveats.md`
   "Ad-Level Attribution from GHL Goes To Campaign, Not Ad". Be honest:
   the join is reliable at campaign level, fuzzy at ad-set / ad level.

**Sample reply shape:**

> Last 7 days, Meta drove webinar regs through 2 active campaigns:
>
> - **[NMM] – Webinar campaign** (new account): 446 regs, $1,963 spend,
>   $4.40 cost per reg.
> - **[NMM] – Big Lump Sun** (new account): 13 regs, $274 spend, $21.10
>   cost per reg.

---

## 12. "How many leads did <setter>'s links bring in?" (setter-ref attribution)

**Steps:**
1. Filter `stg_ghl_weekly_webinar_regs` (and `_monthly` if relevant) by
   `ref_param IS NOT NULL` and the date window.
2. Map ref tokens to setter names:
   - `swp` → **Swapnil**
   - `hna` → **Hania**
   - `sal` → **Salony**
   - Any other ref → tell the user; that's a new ref Ops hasn't documented
     yet. See user memory `setter-ref-params`.
3. Count both rows and `COUNT(DISTINCT contact_id)` (some people register
   multiple times via the same link).
4. Report side-by-side.

**Sample reply shape:**

> Last 30 days from setter referral links:
> • **Swapnil**: 69 registrations from 60 unique contacts
> • **Hania**: 23 registrations from 22 unique contacts
> • **Salony**: 14 registrations from 11 unique contacts

---

## 13. "Who attended the webinar but didn't book a call?" (funnel-leak)

**Steps:**
1. From `stg_zoom_webinar_attendance` for the target `webinar_date`,
   deduplicate by email and apply the staff-exclusion filter (see
   `caveats.md`).
2. Anti-join against `stg_calendly` bookings in the appropriate window
   (Sun→Tue for Sunday webinars, Wed→Fri for Wednesday) using
   `is_webinar_booking = TRUE AND is_canceled = FALSE`.
3. If the user wants a list, default to top 10 by duration. If they want
   everyone, return all but flag "you're asking about N people — would
   you like a CSV instead?"
4. If your "attendees" count is slightly off from `mart_webinar_events`,
   that's normal — the mart applies slightly different exclusions; see
   `caveats.md`. Don't fight the user over the small delta.

**Sample reply shape:**

> May 17 Sunday webinar: 128 attendees, 13 booked a call within the Sun→Tue
> window, **115 didn't.** Top 10 by attendance duration who didn't book:
> [name, email, duration].

---

## 14. "What are the 5 headline KPIs this week?" / Weekly-report KPI strip

The weekly report uses a locked **5-KPI strip** at the top of every tab.
If a user asks about "the weekly KPIs" or wants to mirror the report,
these are the canonical sources and formulas. Don't reinvent them.

**Window for all five:** previous Sun → Sat (sales week).

| KPI | Class | Source / formula |
|---|---|---|
| Webinar Show Rate | Webinar-specific | `int_calls_enriched` filtered to `final_marketing_flow LIKE '%Webinar%'`; show rate per the canonical formula in `caveats.md` |
| % Tier 1 Leads | Webinar-specific | `SUM(mart_webinar_events.tier_one_submissions) / SUM(tier_form_submissions)` |
| Blended Cash ROAS | Overall company | `SUM(stg_fanbasis_sales.amount WHERE status='completed') / SUM(total_ad_spend)` |
| CPL Blended | Overall company | Numerator: total ad spend. Denominator: total leads (definition pending — open spec item §11.2) |
| Cash per Booked Call | Overall company | `SUM(stg_fanbasis_sales.amount) / SUM(total_calls_booked)` |

When presenting these together, mark the top 2 as **webinar-specific** and
the bottom 3 as **blended / company-wide**. They should be visually
separated in the reply.

---

## 15. "Show me sales cycle (booking → close, first-call → close)"

**Steps:**
1. Use the **median** for both. The mean is skewed by a long tail of
   late-closing deals.
2. Split by `close_type`:
   - **OCC** (One-Call-Close): `APPROX_QUANTILES(booking_to_close_days,
     2)[OFFSET(1)]` over `int_calls_enriched WHERE is_deal=TRUE AND
     close_type='OCC' AND calendly_created_ts IS NOT NULL`.
     Typically ~2 days.
   - **FUC** (Follow-Up-Close): `APPROX_QUANTILES(first_call_to_close_days,
     2)[OFFSET(1)]` over `is_deal=TRUE AND close_type='FUC'`.
     Typically ~21 days.
3. Note the filter: `booking_to_close_days` is NULL when Airtable didn't
   link to a Calendly event — only ~2.4% of rows are affected, but still
   filter `calendly_created_ts IS NOT NULL` and report the included
   sample size. (`first_call_to_close_days` is more reliably populated.)
4. **Don't use mart_high_level_daily for this** — medians can't be rolled
   up across pre-aggregated days. Compute directly from
   `int_calls_enriched`.

**Sample reply shape:**

> Last 30 days:
> • **One-call-close cycle (OCC):** 2-day median (from 18 OCC deals)
> • **Follow-up-close cycle (FUC):** 21-day median (from 7 FUC deals)
> Note: 4 deals couldn't be linked to a booking timestamp and weren't
> included.

---

## 16. "How is reactivation doing?" (Era 3 only)

**Steps:**
1. `mart_webinar_events` exposes `reactivation_pool_size`,
   `reactivations_attended`, `reactivations_booked` per webinar.
2. These are NULL when `is_reactivation_data_available = FALSE` — that's
   TRUE only for webinars after no-show tagging began (Era 3, late 2025
   onward).
3. If the user's range spans pre-tagging webinars, **report only the
   webinars where the flag is TRUE**, and tell the user how many were
   excluded.
4. Reactivation = a prior no-show contact whose next webinar attendance
   is this one. Tracked in `int_webinar_reactivations`.

---

## Ad-hoc questions not covered here

Build from `data_model.md`. Process:

1. Identify which **entities** the question touches (lead, registrant,
   attendee, call, deal, cash, ad, setter, closer, webinar).
2. Map each entity to its **source table** in `data_model.md`.
3. Identify the **time grain** the user implicitly wants (single day, week,
   month, custom range).
4. Decide whether a **mart** already answers it. Marts are pre-joined,
   pre-attributed, and cheaper. Drop to staging/raw only when the mart
   doesn't expose what you need.
5. Apply the **caveats** before reporting numbers.

If the question is genuinely ambiguous, **ask one clarifying question
first**.

---

## Things you'll be asked but cannot fully answer

| Question | Honest answer |
|---|---|
| "Which ManyChat funnel did this person come from?" | "We can see they came in via ManyChat, but funnel + keyword aren't in the warehouse yet — coming soon." |
| "What was the ROAS on this ad pre-November 2025?" | "Numbers before November 2025 come from a frozen legacy model with less granularity — I can show you the rolled-up figure but not the per-ad breakdown." |
| "Who attended the webinar but never registered?" | "Zoom only shows people who joined via the link, which always goes through registration. If they attended without registering, they're not in our data." |
| "What's the closer's commission?" | "Commission calculations aren't in the warehouse — that lives in payroll. Ask Ops." |
| "Show me the recording of this call." | "Recordings live in the team's call-review tool, not BigQuery." |
| "Can you fix this row?" | "I'm read-only. Flag it in `#growth-ops` and someone will correct it at the source (Airtable / GHL)." |
