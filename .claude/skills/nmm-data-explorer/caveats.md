# Caveats — Read Before Reporting Any Number

This file is for **Claude's eyes**. Every business number in this warehouse
has a footnote. The ones below are the footnotes that bite us in
leadership conversations if you don't flag them.

Rule: **if a caveat applies to a number you're about to report, mention it
in the same response as the number**. Don't bury it.

---

## Cash Collected ≠ Banked Cash (★ flag every cash number)

What the warehouse calls "cash collected" is what the closer entered in
Airtable on the closing call. It's **not** the same as money that landed
in NMM's bank account.

| Source | What it represents | Reliability |
|---|---|---|
| `int_calls_enriched.cash_collected` (Airtable) | Closer-reported, on the call | Closer to "intent to collect" than "collected" |
| `stg_fanbasis_sales.amount` (Fanbasis payment processor) | What the processor recorded | Closer to banked cash |
| Banked cash | Funds in NMM's actual bank | Lower again — **Payva (the BNPL partner) withholds ~65%** as a reserve |

**How to phrase it to a user:** if they ask for "cash collected," report
the Airtable figure (it's what they typically mean), but if they're making
a decision based on that number, add a one-liner:

> Note: this is closer-reported cash from Airtable. Actual banked cash is
> lower — Payva (our BNPL partner) holds back roughly 65% as a reserve.
> For banked cash, I'd need to pull from the payment processor and apply
> the holdback ratio.

If they want the more accurate number, use `total_cash_collected_fanbasis`
from `mart_high_level_daily` (canonical processor cash) — and still flag
the Payva holdback.

User memory ref: `cash-collected-is-overstated`.

---

## Dispositioning Lag — Up to ~45% of last-week's calls aren't dispositioned yet

Closers don't always disposition calls in real time. In a typical
mid-week snapshot, **roughly half of calls in the trailing 7 days are
still undispositioned** (recent measurement: 119 of 266 = 45% pending). The
share drops sharply once you push out to 14+ days — the backlog clears
fairly quickly — but the current-week snapshot is dramatically incomplete.

Concretely, "shows this week" / "deals this week" / "cash this week" can
all rise 50% or more over the next 24–72 hours as dispositioning catches
up.

**When to apply the caveat:**

| User's query window | Caveat to surface |
|---|---|
| Today only | Most calls won't be dispositioned yet — numbers will climb significantly. |
| Trailing 1–3 days | ~30–50% still pending. Don't anchor decisions on these numbers. |
| Trailing 4–7 days | ~10–25% may still be pending. Worth mentioning. |
| Trailing 8–14 days | Mostly settled. Mention only if the user asks why an older number changed. |
| 15+ days back | Should be fully settled. No caveat needed. |

**How to phrase it:**

> Heads-up: of the calls in this window, [N of M] (X%) haven't been
> dispositioned yet — shows, deals, and cash for this period will climb
> as closers catch up. I wouldn't anchor a decision on these numbers
> for ~48–72 hours.

To make the caveat concrete in a given response, **count the
undispositioned share** in the same query:
```sql
COUNTIF(is_dispositioned = FALSE) AS pending,
COUNT(*) AS total
```
and report the actual ratio rather than a vague "may be incomplete."

**Don't** call this a data problem to the user. It's normal closer
workflow.

User memory ref: `dispositioning-lag-is-normal`.

---

## Two Meta Ad Accounts, Unioned at March 4, 2026

The old Meta account was restricted in March 2026 and a new one took over.
The warehouse unions both:

- **Spend / impressions / reach / clicks / conversions before 2026-03-04** →
  comes from `raw_meta_facebook_ads` (the old account).
- **From 2026-03-04 onward** → comes from `raw_meta_2_reports`.
- `stg_meta_campaigns` handles the union transparently — querying it
  always works.

**Caveat to flag:** if a user asks about an individual ad / ad set / 
campaign by name, and that campaign ran in both accounts (the team
re-created campaigns under similar names in the new account), the row in
the warehouse may have different campaign IDs across the cutoff. Tell the
user we have full coverage but the campaign ID changed — naming may be
sufficient to bridge.

**Never query raw_meta_2.basic_campaign for spend.** That table is only
useful for inline link clicks, reach, frequency — which aren't exposed by
the report model. For spend/impressions/conversions, use the report model.

---

## Webinar Attribution Windows

The warehouse maps each registration and each call back to a webinar using
fixed windows. If a user asks "how many registrants for the Sunday May 17
webinar?", here's the window:

| User registered on… | Attributed to which webinar? |
|---|---|
| Mon / Tue / Wed | **That Wednesday's** webinar |
| Thu / Fri / Sat / Sun | **That Sunday's** webinar |

For **ad spend** (Sunday + Wednesday share the Sunday day 50/50):

| Day of spend | Attributed to which webinar? |
|---|---|
| Thu, Fri, Sat | Sunday |
| Sunday | 50% Sunday, 50% the following Wednesday |
| Mon, Tue, Wed | Wednesday (unless no Wednesday webinar that week — then Sunday) |

For **call bookings** (when did they book from each webinar):

| Webinar | Booking window |
|---|---|
| Sunday | Sun night → Tue |
| Wednesday | Wed night → Fri |
| Typeform (post-attendee) | Use `booking_week_sun` + the appropriate window above |

**Don't redo this attribution in queries** — the marts (`mart_webinar_events`,
`int_funnel_webinar_core`) already implement it. If you go to staging
tables and reimplement, you'll diverge from the marts.

---

## Internal Staff Exclusion (Calendly + Zoom)

Internal team members test webinars and book calls on each other. They
appear in raw Zoom + Calendly data and inflate numbers if not excluded.

**Always exclude on Zoom (`webinar_participant`):**
```
LOWER(user_email) NOT LIKE '%@nomoremondays.io%'
AND LOWER(user_email) NOT IN (
  'jaromir1998@gmail.com',
  'marek@sintano.com',
  'office@spark-value.com'
)
AND LOWER(name) NOT LIKE '%notetaker%'
```

**Always exclude on Calendly (`stg_calendly`):**
```
LOWER(invitee_email) NOT LIKE '%@nomoremondays.io%'
AND LOWER(invitee_email) NOT IN (
  'jaromir1998@gmail.com',
  'marek@sintano.com'
)
```

The marts already apply these. If you go to staging/raw, apply them.

---

## `int_calls_enriched` — Special Date Behavior

`appointment_date_time` is **not** always the original appointment time:

- For calls that ended as deals, it gets overwritten with the deal-close
  timestamp.
- For undispositioned / not-taken calls, it remains the originally-booked
  appointment time.

This means a query like "calls scheduled for tomorrow" using
`appointment_date_time` will under-report if any of those calls have
already become deals (which would be weird, but it happens with same-day
closes).

**Practical impact:** for "calls held today" / "deals today" type
questions, this works fine because the date matches reality. For "calls
scheduled" type questions, you may want `calendly_start_time` instead.

---

## Monthly Lump Sum Workshop REPLACES The Sunday Webinar That Week

**Critical rule that changes how you describe customer journeys.**

When a Monthly Lump Sum Workshop is scheduled, it **runs on a Sunday and
takes the place of the regular Sunday Freedom Creator Workshop** for that
week. They never coexist — verified empirically across six monthly weeks
in the last six months.

**Implications when tracing an individual customer:**

- A customer who registered for the Monthly funnel and "attended a Sunday
  webinar" the same week probably attended **the same Monthly Workshop
  they registered for** — not a separate Sunday event.
- Before saying "registered for the monthly but converted off the Sunday
  webinar," check `mart_webinar_events.webinar_day` for that date.
  `'Monthly Workshop'` means there was no separate Sunday event.
- The **GHL tag prefix disambiguates**:
  - `event: workshop-YYYY-MM-DD` → Monthly Lump Sum Workshop
  - `event: webinar-YYYY-MM-DD` → weekly Freedom Creator Workshop
- Name the event accurately in the reply: "the May 24 Monthly Lump Sum
  Workshop" — not "the Sunday webinar" when the Sunday was a monthly.

The "never mix at the funnel level" rule below still applies to **rollup
queries** — monthly and weekly aggregate separately. This rule is about
**individual journeys** not getting mislabeled.

---

## Cleaned `traffic_source` Under-Counts Meta — fbclid Is The Real Signal

The cleaned `traffic_source` column on `stg_ghl_*_regs` only labels a
registration `'meta'` when `utm_source IN ('fb','ig','an')` AND
`utm_medium = 'paid'`. If a Meta click drops the UTMs but still carries
the **fbclid** (Facebook's click ID, stamped on every Meta link), the
registration silently falls through to `'direct_or_unknown'` or
`'organic_social'`.

**Verified scale of the gap (last 30 days, weekly form alone):**

| traffic_source | regs | % with fbclid |
|---|---|---|
| meta | 4,590 | 99.9% |
| direct_or_unknown | 663 | **12.2%** |
| organic_social | 406 | **56.9%** |

So ~81 Meta arrivals/month are bucketed as direct in the weekly form
alone. Total Meta-driven volume is materially under-counted in the
cleaned feed.

**How to apply:**

- **For per-customer journey questions:** when `traffic_source` returns
  `'direct_or_unknown'`, **do not stop there.** Pull the raw `others`
  JSON from `raw_ghl.registrations_weekly_webinar` (or the monthly
  sibling) and check
  `JSON_EXTRACT_SCALAR(others, '$.eventData.url_params.fbclid')`.
  If non-NULL, the customer arrived from a Meta click.
- **Be honest about the attribution depth.** An fbclid confirms "from
  Meta" but tells you nothing about which campaign or ad. No
  `utm_campaign` = no join to `stg_meta_campaigns`. Say: "Meta click
  confirmed, specific campaign unknown."
- **For aggregate channel-mix questions:** flag the under-count. The
  cleaned `traffic_source` is ~12% pessimistic on Meta vs direct.
- This is a known gap. A dbt-level fix (add `fbclid IS NOT NULL` as a
  Meta fallback in the staging rule) is a separate engineering task —
  surface it to `#growth-ops` if it comes up.

---

## GHL Contact Tags — The Richest Signal For Individual Journeys

The cleaned tables (`stg_ghl_*`, `int_calls_enriched`) intentionally
compress the firehose of GHL activity into normalized columns. For an
**individual customer journey**, the raw `raw_ghl.contacts.tags` JSON
array is often more informative than the cleaned tables — it captures
every stage in flight.

**Tags you'll commonly see and what they mean:**

| Tag pattern | What it tells you |
|---|---|
| `status: registered`, `status: attended`, `status: call-booked`, `status: won`, `status: closer-dispo`, `status: refunded` | Funnel-stage transitions, ordered by date the tag was applied |
| `event: webinar-YYYY-MM-DD` | Registered/attended a weekly Sunday or Wednesday webinar on that date |
| `event: workshop-YYYY-MM-DD` | Registered/attended a Monthly Lump Sum Workshop on that date |
| `attended-workshop-YYYY-MM-DD` / `attended-webinar-YYYY-MM-DD` | Confirmed live attendance for the dated event |
| `ws<N>-a`, `ws<N>-b` (e.g. `ws11-a`) | Setter assignment to a Workshop Setter pod |
| `manychat`, `manychat-<funnel>` | Came in via or interacted with ManyChat (when those tags exist; ManyChat data isn't fully in the warehouse yet) |
| `vip accelerator purchased`, `inner circle member`, `creator agreement signed` | Product / membership flags |
| `webinar occ`, `webinar fuc` | Close type (one-call-close vs follow-up-close) |
| `dialed: no answer`, `follow up in 30m` | Setter activity notes |

**How to apply:**

- For "where did this customer come from?" / "trace the journey," **always
  pull `raw_ghl.contacts.tags`** as part of the response, alongside the
  structured signals. Many tags carry attribution info that the cleaned
  feeds drop (e.g. ManyChat involvement, product purchased, setter pod).
- If you see `status: won` or `vip accelerator purchased` but the Airtable
  closing-call record is still open, that's a **dispositioning lag**
  signal — the close is real, the closer just hasn't logged it. Apply the
  dispositioning-lag caveat.
- For free-text searching across many contacts (e.g. "show me everyone
  tagged as ManyChat"), use the normalized `raw_ghl.contact_tags` table
  (one row per (contact_id, tag) pair) instead of trying to scan the
  JSON column.
- `raw_ghl.contacts.attribution_source` is a JSON column too, but it is
  **NULL on essentially every contact** (verified: 0 of 20,269 recent
  contacts had a non-null value). Don't waste a query on it.

---

## Monthly Lump Sum vs Weekly Webinar — Never Mix (at the funnel level)

The Monthly Lump Sum Workshop is a separate funnel from the Sunday +
Wednesday Freedom Creator Workshops. Even though both run "webinars," they
have different:

- Ad campaigns (`monthly_workshop_*` vs `webinar_*`)
- Registration tables (`registrations_monthly_workshop*` vs
  `registrations_weekly_webinar*`)
- Pricing / pitch / product
- Show rates and close rates

`mart_webinar_events` separates them via `webinar_day = 'Monthly Workshop'`.
Filter by `webinar_day` whenever the user is talking about one or the
other.

If a user says just "the webinar" without qualification, **assume weekly
(Sunday + Wednesday)**. Confirm if ambiguous.

**Caveat — individual customers can cross funnels.** A single contact may
register first for the Monthly Workshop, then later register for a weekly
Sunday webinar, and ultimately close on a call attributed to the Sunday
flow (`final_marketing_flow = 'Webinar'`). The "never mix" rule applies to
**funnel-level rollups**, not to individual customer journeys. When tracing
one customer, always query both funnels' registration tables and union the
results — that's how you tell the full story.

---

## Verify the Consuming Layer Before Naming a Root Cause

If a user says "Looker is showing 14 deals but you're saying 12" —
**don't** assert "Looker is wrong" without verifying. Looker has its own
formulas on top of the marts. They may diverge from the mart in known
ways (e.g. show rate computed differently). Before declaring a root
cause, ask the user to share the Looker tile's formula, or hedge:

> Possible reasons for the difference: Looker may filter Calendly events
> differently (e.g. include both Sunday and Wednesday in one tile), or
> apply a different date window. I'd want to see the tile's formula
> before saying which is right.

User memory ref: `verify-consuming-layer-before-root-cause`.

---

## Pre-November 2025 Numbers

The source of truth for call outcomes changed in November 2025 (from
Closersheet to Airtable). For dates **before Nov 2025**:

- Per-call data isn't available; only weekly rollups via
  `stg_closersheet_metrics_weekly` and `int_funnel_webinar_legacy`.
- "Cash collected" pre-Nov uses different categorization.
- The marts treat pre-Nov rows as `is_legacy = TRUE`.

If a user's date range crosses Nov 2025, tell them:

> Some of this range is from before our Nov 2025 data overhaul. I can give
> you the rolled-up weekly numbers for that period but not the per-call
> detail.

---

## Show Rate / Close Rate — Use the Eligibility Flags, Not `is_show_up` Alone

The canonical Looker formulas — what dashboards report and what leadership
expects to see — use `COUNT_DISTINCT(prospect_email_lc)` on
**eligibility-filtered** numerators / denominators. Use the same formulas:

| Metric | Numerator | Denominator |
|---|---|---|
| **Show rate** | `COUNT_DISTINCT(prospect_email_lc WHERE is_show_up)` | `COUNT_DISTINCT(prospect_email_lc WHERE is_show_rate_eligible)` |
| **Close rate** (preferred — closer-qualified) | `COUNT_DISTINCT(prospect_email_lc WHERE is_deal)` | `COUNT_DISTINCT(prospect_email_lc WHERE is_close_rate_eligible)` |
| **Blended funnel efficiency** | `COUNT_DISTINCT(is_close_rate_eligible)` | `COUNT_DISTINCT(is_dispositioned)` |
| **OCC %** (one-call-close) | `COUNT_DISTINCT(close_type='OCC')` | `COUNT_DISTINCT(is_deal)` |
| **Setter DQ rate** | `COUNT_DISTINCT(call_outcome='Setter DQ')` | `COUNT_DISTINCT(is_dispositioned)` |
| **Closer DQ rate** | `COUNT_DISTINCT(call_outcome='Closer DQ')` | `COUNT_DISTINCT(is_show_up)` |

**Why eligibility flags matter:**

- `is_show_rate_eligible` excludes rescheduled calls (`is_rescheduled =
  TRUE`) from the denominator — otherwise rescheduled calls drag the rate
  down unfairly.
- `is_close_rate_eligible` excludes both **Setter DQ** and **Closer DQ**
  from the denominator — neither is a fair "could-have-closed" call.

**The Setter DQ bug context:** Raw Airtable sets `is_call_held = TRUE` for
Setter DQ rows (because the closer dispositioned the call), but those are
PRE-call disqualifications, not held calls. The `is_show_up` flag was
introduced to fix this — it correctly excludes Setter DQ. If you use the
old `is_call_held` flag, your show numbers will be inflated. **Never use
`is_call_held` or `is_held`** — both were removed 2026-05-16. Use
`is_show_up`.

**Row-level vs distinct counts:** Funnel stages use
`COUNT_DISTINCT(prospect_email_lc)` because a prospect can have multiple
appointment rows (ghosted, rescheduled, then showed up). For an additive
waterfall where every row counts, use `COUNT(id)` instead. Pick the right
one for the question.

---

## `appointment_date_time` Is Overridden For Closed Deals

A subtle and dangerous quirk: for rows where `is_deal = TRUE`,
`appointment_date_time` gets overwritten with `date_closed` (cast as a
timestamp). This is intentional — it puts the deal in the correct sales
week for Looker rollups — but it means:

- **For sales-cycle calculations** ("how long from booking to close?"),
  use `calendly_created_ts` (raw booking) → `date_closed`. Do NOT use
  `appointment_date_time` as a "scheduled-for" timestamp.
- **For raw call timing** (when did the call actually happen), use
  `call_date_time` — that column is the unadjusted appointment time.
- **For funnel-stage rollups by week** (calls booked, shows, DQ), keep
  using `appointment_date_time` — that's what `mart_high_level_daily`
  expects.

If a query needs the raw appointment time, always pull `call_date_time`,
not `appointment_date_time`.

Also: `created_date` in `int_calls_enriched` is NOT the booking date — it
is the Fivetran sync time. The real booking timestamp lives in
`calendly_created_ts` (and is NULL for ~50% of rows because not every
Airtable record links to a Calendly event).

---

## Sales-Cycle Medians — Always MEDIAN, Never Mean

Sales-cycle measurements have a long tail (a small share of deals close
months after first touch and would skew an average). Always report the
**median**:

- **OCC cycle** (one-call-close): median of `booking_to_close_days` for
  deals with `close_type = 'OCC'`. Typically ~2 days.
- **FUC cycle** (follow-up close): median of `first_call_to_close_days`
  for deals with `close_type = 'FUC'`. Typically ~21 days. The mean here
  is ~32 days because of the long tail — don't report it.

**These medians are NOT in `mart_high_level_daily`.** Compute them
directly from `int_calls_enriched` per the user's date range. (Medians
don't roll up across pre-aggregated days, which is why the mart doesn't
expose them.)

---

## Cash Columns: `total_cash_collected` vs `total_cash_collected_fanbasis`

These two cash columns in `mart_high_level_daily` are NOT interchangeable.
Use the wrong one and the user will get a number that doesn't reconcile to
anything they trust.

| Column | Source | Anchor | Use For |
|---|---|---|---|
| `total_cash_collected_fanbasis` | Bank-side (payment processor; includes payment-plan installments + renewals) | `stg_fanbasis_sales.sale_date` | **Cash Collected** headline KPI; **Cash ROAS (Fanbasis)** |
| `total_cash_collected` | Closer-reported on the call (Airtable upfront) | `date_closed` | **AOV, ACV, DPC**, per-closer attribution, Closer dashboard |

**Both cash ROAS variants matter** — leadership wants both shown side-by-
side, not collapsed:

- **ROAS (Cash, Fanbasis)** = `total_cash_collected_fanbasis /
  total_ad_spend` — the CEO headline default.
- **ROAS (Cash, Airtable)** = `total_cash_collected / total_ad_spend` —
  attribution view.

**Every other deal metric (AOV, ACV, DPC) uses Airtable-basis only — never
Fanbasis.**

The original "cash is overstated" caveat (Payva 65% holdback) still
applies — `total_cash_collected` is even further from banked cash than
`total_cash_collected_fanbasis` (which IS bank-side).

---

## `call_status_category` Is The Right Looker Dimension

`int_calls_enriched.call_status_category` is non-NULL for every row. It's
a pre-rolled-up dimension that intelligently maps call outcomes,
reschedules, and not-taken-reasons into a single tidy bucket. **Prefer it
over raw `call_outcome` / `not_taken_category` / `not_taken_reason`** when
the user wants a high-level breakdown ("what happened to all the calls
booked last week?").

Use the raw fields only when the user explicitly wants a finer breakdown.

---

## `setter_owner` Data Is Messy — Fuzzy-Match It

Real values in `int_calls_enriched.setter_owner` include all of the
following, often for the same person:

- First-name only: `Swapnil`, `Hania`, `Sal`, `Aviyhon`
- Misspelled first-name: `Avihyon` (same person as `Aviyhon`)
- Full name + workshop tag: `Teddy Seaton WS11`, `Ahmad Yasin WS2`,
  `Joel Brown WS5`, `Tony Rodriguez WS1`
- **Bare workshop tag only:** `ws11`, `ws8`, `ws5`, `ws20`
- Mixed case in the WS tag: `Otto Dix-Masson ws7` (lowercase ws)
- `NULL` (35 calls in a recent 30-day window had no setter)

**When a user asks "How is Teddy doing?" you must:**

1. Match the name AND the WS tag, case-insensitive:
   ```sql
   WHERE LOWER(setter_owner) LIKE '%teddy%' OR LOWER(setter_owner) LIKE '%ws11%'
   ```
   (Only include the WS-tag clause if you already know Teddy is WS11 — see
   `setter-owner-format` user memory for the canonical list of WS people.)
2. Return results grouped by `setter_owner` (the literal string) so the user
   can see how their calls are split across spellings.
3. If you see bare-WS-tag entries (`ws11` etc.), call them out explicitly:
   "I'm also seeing 4 calls tagged just 'ws11' with no name — these are
   probably Teddy's but I can't confirm without checking with Ops."
4. If there's a misspelling (Avihyon ≠ Aviyhon), report it as a separate
   row and flag it.

**For "first-name only" setters** (Aviyhon, Hania, Swapnil, Sal, Salony) the
match is exact. **For WS setters** there is variance. See user memory
`setter-owner-format`.

---

## Email Match Airtable ↔ GoHighLevel is Lossy

When you trace a closed deal back to its registration to find the traffic
source, **a large share of deals will fail to match.** In one dry run, 56%
of last week's deals had no matching GHL contact by email — meaning the
email on the Airtable closing call differs from the email on the GHL
contact (or the contact was never in GHL).

**How to handle it:**

1. Always report the unmatchable deals as a separate bucket. Don't just
   silently drop them — that misleads the user.
2. Phrase it like: "Of the 18 deals last week, 8 reconciled to a Meta lead,
   2 reconciled to direct/unknown traffic, and **8 could not be linked back
   to a registration record** — usually because the email on the closing
   call differs from the email on the GHL contact."
3. Suggest phone-number matching as a fallback if the user wants better
   coverage:
   ```sql
   LEFT JOIN raw_ghl.contacts c
     ON LOWER(c.email) = d.prospect_email_lc
     OR REGEXP_REPLACE(c.phone, r'[^0-9]', '') = REGEXP_REPLACE(d.phone, r'[^0-9]', '')
   ```
   (But note `int_calls_enriched` may not carry phone — confirm before
   suggesting.)

---

## Ad-Level Attribution from GHL Goes To Campaign, Not Ad

`stg_meta_campaigns` is at the **campaign-day grain.** It has no ad-set or
ad-level columns. For ad-set / ad breakdown, go to:

- `raw_meta_2_reports.facebook_ads__ad_report` (new account, since 2026-03-04)
- `raw_meta_facebook_ads.facebook_ads__ad_report` (old account, pre-2026-03-04)

But the join from GHL is **only reliable at the campaign level**:

- `stg_ghl_weekly_webinar_regs.utm_campaign` carries the Meta campaign ID
  (numeric string — `SAFE_CAST` to INT64 before joining to
  `stg_meta_campaigns.campaign_id`).
- `utm_content` / `utm_term` *sometimes* carry ad-set or ad identifiers,
  but the convention isn't consistent. Don't promise the user an
  "ad-level breakdown" without confirming the UTMs encode it.

When a user asks "which AD specifically brought these leads," the honest
answer is usually: "I can break it down by campaign. I can sometimes go
deeper to ad-set or ad if the UTMs were tagged that way — let me check."

---

## `stg_calendly` — Use The Pre-Computed Flags

`stg_calendly` is a VIEW with pre-computed flags. Don't reimplement.

| Question | Filter to use |
|---|---|
| "Any sales call booking" | `LOWER(event_name) LIKE '%strategy%'` (matches `mart_high_level_daily.total_calls_booked`) |
| "Webinar-sourced booking only" | `is_webinar_booking = TRUE` |
| "Setter-booked only" | `is_setter_booking = TRUE` |
| "Was the booking actually live?" | `is_canceled = FALSE` |

Note: these definitions differ.
- `is_webinar_booking = TRUE` includes typeform follow-ups (`'post-attendee
  webinar typeform'`, `'live webinar - typeform'`) — so "calls booked from
  the webinar" via this flag captures the full webinar funnel including
  late-arriving typeforms.
- `event_name LIKE '%strategy%'` is broader — it captures setter-booked
  strategy calls too.

The dashboards (`mart_high_level_daily.total_calls_booked`) use the broader
"strategy" filter. Stay consistent with that for any "calls booked" number
the user might compare to a dashboard tile.

---

## ROAS Reporting — Hide For In-Progress Webinars

The weekly report has a locked rule that's worth following anywhere ROAS
might be reported:

- **T-0 (in-progress webinar, current cycle):** Hide ROAS rows, or show
  them as `—` with an `(in-progress)` tag. ROAS without final cash is
  misleading.
- **T-0 partial downstream IS shown.** Deals closed, cash collected, and
  calls held so far are informative — show them with a `(partial)` tag.
- **T-4 / T-7 / completed webinars:** Full ROAS, full downstream, no tags
  needed.

When a user asks about "this Sunday's webinar" and it's mid-cycle, follow
this rule: report the funnel-to-date, omit the ROAS, and explain why.

---

## Cost Per Booked Call — Weekly/Monthly Grain Only

`total_ad_spend / total_calls_booked` is a common KPI but has a multi-
day lag (spend → registration → webinar → booking). Compute it at
weekly or monthly grain ONLY:

- ✓ "Cost per booked call last week" (Sun→Sat) — fine.
- ✓ "Cost per booked call last month" — fine.
- ✗ "Cost per booked call yesterday" — meaningless. First-of-range and
  last-of-range days distort the ratio because the lag concentrates.

If the user explicitly asks for daily CPBC, give it but warn that it's
noisy and recommend the weekly view.

---

## Reporting Across Both Anchors — State Which Is Which

When a single response references both a sales metric (cash, revenue,
deals) and a marketing metric (ad spend, CPL, ROAS), **label which date
anchor each uses** somewhere visible. The two anchors are:

- **Sales week** (Sun→Sat on `date_closed` or
  `appointment_date_time::date`): cash, revenue, deals, PIF.
- **Marketing week** (Sun 50% → Sun 50%, applied by the marts): ad spend,
  CPL, ROAS, CPR, CPBC.

If a sales number and a marketing number don't appear to reconcile to the
user, the answer is almost always "they're on different anchors." Save
yourself the round-trip — label up-front.

---

## Closed Deals — Never Touch

A side rule that mostly applies to ops scripts but worth knowing: GHL
contacts with deal-progress records in Airtable should never have their
closer fields PATCHed by backfill scripts. Doing so propagates damage via
LeadConnector sync. If a user asks you to "update the closer for this
deal," **don't** — flag it to ops.

User memory refs: `never-touch-closed-deals`, `ghl-dispo-form-stamps-setter`.
