// Central registry of metric definitions used across the dashboards.
// Every <InfoTip metric="…" /> on a KPI label or chart axis looks up here.
//
// Each entry has three layers of disclosure:
//   1. label        — human-readable name shown in the popover header
//   2. description  — plain-English business definition (always shown)
//   3. formula      — plain-English calculation (always shown)
//   4. sql          — actual SQL snippet from the dbt mart (devMode only)
//   5. source       — fully-qualified BQ table / view (devMode only)
//
// Treat this as a living source of truth — when the analytics repo
// (no-more-mondays-analytics) changes a column, update the corresponding
// entry here in the same commit. Seeded for Phase A with the columns the
// existing webinar + CEO dashboards already render; remaining tiles
// added as Phase B touches each component.

export type MetricDef = {
  key: string;
  label: string;
  description: string;
  formula: string;
  sql?: string;
  source?: string;
};

export const METRIC_DEFS: Record<string, MetricDef> = {
  // ===== mart_webinar_events — Marketing =====

  total_webinar_ad_spend: {
    key: "total_webinar_ad_spend",
    label: "Total Webinar Ad Spend",
    description:
      "All Meta ad spend on webinar campaigns attributed to this webinar — both Registration campaigns and Hammer-Them retargeting. Sunday-day spend is split 50/50 between that Sunday's webinar and the following Wednesday's.",
    formula: "Webinar Reg Ad Spend + Webinar Hammer-Them Ad Spend",
    sql: "-- dbt-tested invariant\n-- total_webinar_ad_spend = webinar_reg_ad_spend + webinar_hammer_them_ad_spend",
    source: "no-more-mondays-analytics.dbt_tuddin.mart_webinar_events",
  },
  webinar_reg_ad_spend: {
    key: "webinar_reg_ad_spend",
    label: "Webinar Reg Ad Spend",
    description:
      "Meta spend on webinar Registration campaigns only — the spend that drives new opt-ins. Excludes Hammer-Them retargeting.",
    formula: "SUM(spend WHERE campaign_category = 'webinar_registration')",
    source: "stg_meta_campaigns → mart_webinar_events.webinar_reg_ad_spend",
  },
  webinar_hammer_them_ad_spend: {
    key: "webinar_hammer_them_ad_spend",
    label: "Hammer-Them Ad Spend",
    description:
      "Meta spend on webinar Hammer-Them retargeting (show-up reminders) only. The book-a-call Hammer-Them campaign is excluded.",
    formula: "SUM(spend WHERE campaign_category = 'webinar_hammer_them')",
    source: "stg_meta_campaigns → mart_webinar_events.webinar_hammer_them_ad_spend",
  },
  frequency_webinar_hammer_them: {
    key: "frequency_webinar_hammer_them",
    label: "Hammer-Them Frequency",
    description:
      "Approximate ad frequency for the Hammer-Them webinar campaign over the attribution window. Slightly overstates because it uses MAX daily reach, not unique reach.",
    formula: "SUM(impressions) / MAX(daily reach)",
    sql: "-- NULL when no reach data and for legacy rows.",
    source: "mart_webinar_events.frequency_webinar_hammer_them",
  },
  meta_link_clicks: {
    key: "meta_link_clicks",
    label: "Meta Link Clicks",
    description:
      "Outbound link clicks from Meta webinar registration ads. Replaces the old all-clicks metric.",
    formula: "SUM(link_clicks) across registration campaigns",
    source: "raw_meta basic_campaign tables → mart_webinar_events.meta_link_clicks",
  },
  cash_collected_per_attendee: {
    key: "cash_collected_per_attendee",
    label: "Cash / Attendee",
    description:
      "Average cash collected per person who attended the webinar live. Excludes registrations who never showed.",
    formula: "cash_collected / unique_attendees",
    source: "mart_webinar_events",
  },
  contract_value_per_attendee: {
    key: "contract_value_per_attendee",
    label: "Contract Value / Attendee",
    description:
      "Average total contract value (TCV) generated per live attendee.",
    formula: "revenue_generated / unique_attendees",
    source: "mart_webinar_events",
  },

  // ===== mart_webinar_events — Sales =====

  shows: {
    key: "shows",
    label: "Shows",
    description:
      "Number of booked prospects who actually showed up to the call. PR #43 excludes Setter DQs from this count — historical values may look smaller than the pre-fix \"Calls Held\" you remember; this is a bug fix.",
    formula: "COUNTIF(is_show_up) — i.e. attended AND call_outcome != 'Setter DQ'",
    sql: "COUNTIF(is_show_up) AS shows",
    source: "int_calls_enriched → mart_webinar_events.shows",
  },
  qualified_shows: {
    key: "qualified_shows",
    label: "Qualified Shows",
    description:
      "Closer-qualified shows — shows that survived BOTH Setter DQ AND Closer DQ. The denominator for true close-rate.",
    formula: "COUNTIF(is_close_rate_eligible)",
    sql: "-- is_close_rate_eligible := is_show_up AND call_outcome NOT IN ('Setter DQ','Closer DQ')",
    source: "int_calls_enriched → mart_webinar_events.qualified_shows",
  },
  blended_cost_per_show: {
    key: "blended_cost_per_show",
    label: "Cost Per Show",
    description:
      "Total webinar spend divided by show-ups. Renamed from the old \"Cost / held call\".",
    formula: "total_webinar_ad_spend / shows",
    source: "mart_webinar_events.blended_cost_per_show",
  },
  blended_cost_per_qualified_show: {
    key: "blended_cost_per_qualified_show",
    label: "Cost Per Qualified Show",
    description:
      "Spend per show that actually had a real shot at a deal (excludes Setter DQ + Closer DQ).",
    formula: "total_webinar_ad_spend / qualified_shows",
    source: "mart_webinar_events.blended_cost_per_qualified_show",
  },
  blended_cpbc_active: {
    key: "blended_cpbc_active",
    label: "Cost Per Active Booked Call",
    description:
      "Spend per booked call that wasn't canceled before it could be held.",
    formula: "total_webinar_ad_spend / calls_booked_active",
    source: "mart_webinar_events.blended_cpbc_active",
  },
  roas_cash: {
    key: "roas_cash",
    label: "ROAS (Cash)",
    description:
      "Cash-collected return on webinar ad spend. 1.0× = break-even on cash; higher is better.",
    formula: "cash_collected / total_webinar_ad_spend",
    source: "mart_webinar_events.roas_cash",
  },
  roas_revenue: {
    key: "roas_revenue",
    label: "ROAS (Revenue)",
    description:
      "Total contract value (TCV) return on webinar ad spend — includes payment plans whose installments haven't come in yet.",
    formula: "revenue_generated / total_webinar_ad_spend",
    source: "mart_webinar_events.roas_revenue",
  },
  roas_cash_running: {
    key: "roas_cash_running",
    label: "Live ROAS",
    description:
      "Running cash return — sums every Fanbasis payment from deal-prospect emails attributable to this webinar, including payment-plan installments collected after the close. Grows over time. NULL for legacy rows (Fanbasis coverage starts mid-2025).",
    formula: "Σ Fanbasis payments by deal-prospect emails / total_webinar_ad_spend",
    source: "stg_fanbasis_sales → mart_webinar_events.roas_cash_running",
  },
  cac: {
    key: "cac",
    label: "CAC",
    description:
      "Customer acquisition cost — webinar spend per deal closed (not per qualified show, not per attendee).",
    formula: "total_webinar_ad_spend / deals_closed",
    source: "mart_webinar_events.cac",
  },

  // ===== mart_high_level_daily (CEO dashboard) =====

  total_ad_spend: {
    key: "total_ad_spend",
    label: "Total Ad Spend",
    description:
      "Daily Meta spend across ALL campaign categories — webinar reg + webinar Hammer-Them + monthly workshop + book-a-call Hammer-Them + everything else. NOT just webinar.",
    formula: "SUM(spend) across every campaign_category",
    sql: "SUM(spend) AS total_ad_spend",
    source: "stg_meta_campaigns → mart_high_level_daily.total_ad_spend",
  },
  total_calls_booked: {
    key: "total_calls_booked",
    label: "Total Calls Booked",
    description:
      "Strategy-call Calendly bookings created that day. Game plans / inner-circle / non-strategy events excluded.",
    formula: "COUNTIF(LOWER(event_name) LIKE '%strategy%')",
    source: "stg_calendly → mart_high_level_daily.total_calls_booked",
  },
  total_cash_collected: {
    key: "total_cash_collected",
    label: "Total Cash Collected",
    description:
      "Cash on deals closed that day (upfront only — payment-plan installments aren't smoothed back to the original close date).",
    formula: "SUM(cash_collected) WHERE is_deal AND date_closed = metric_date",
    source: "int_calls_enriched → mart_high_level_daily.total_cash_collected",
  },
  total_revenue_contracted: {
    key: "total_revenue_contracted",
    label: "Total Revenue (TCV)",
    description:
      "Total contract value of deals closed that day — includes payment plans before they're collected.",
    formula: "SUM(revenue_generated) WHERE is_deal AND date_closed = metric_date",
    source: "int_calls_enriched → mart_high_level_daily.total_revenue_contracted",
  },
  show_rate: {
    key: "show_rate",
    label: "Show Rate",
    description:
      "Share of dispositioned, show-rate-eligible prospects who actually showed up live. Setter DQs are excluded from BOTH numerator and denominator.",
    formula: "SUM(show_ups) / SUM(show_rate_eligible)",
    source: "int_calls_enriched → mart_high_level_daily counters",
  },
  close_rate_on_shows: {
    key: "close_rate_on_shows",
    label: "Close Rate (Shows)",
    description:
      "Share of show-ups that closed — uses the broad show-up denominator (still includes Closer DQs).",
    formula: "SUM(deals_attended) / SUM(show_ups)",
    source: "mart_high_level_daily",
  },
  close_rate_closer_qualified: {
    key: "close_rate_closer_qualified",
    label: "Close Rate (Qualified)",
    description:
      "Closer's \"real\" close rate — denominator excludes both Setter DQs AND Closer DQs.",
    formula: "SUM(deals_attended) / SUM(close_rate_eligible)",
    source: "mart_high_level_daily",
  },
  setter_dq_rate: {
    key: "setter_dq_rate",
    label: "Setter DQ Rate",
    description:
      "Share of dispositioned prospects the setter flagged as a disqualification before a real call could happen.",
    formula: "SUM(setter_dq) / SUM(prospects_dispositioned)",
    source: "mart_high_level_daily",
  },
  closer_dq_rate: {
    key: "closer_dq_rate",
    label: "Closer DQ Rate",
    description:
      "Share of show-ups the closer disqualified on the call. (Distinct from Setter DQ which happens earlier.)",
    formula: "SUM(closer_dq) / SUM(show_ups)",
    source: "mart_high_level_daily",
  },
  pif_rate: {
    key: "pif_rate",
    label: "PIF Rate",
    description:
      "Share of closed deals paid in full at close (no payment plan).",
    formula: "SUM(pif_deals) / SUM(deals_closed)",
    sql: "-- is_paid_in_full := is_deal AND cash_collected >= revenue_generated",
    source: "int_calls_enriched → mart_high_level_daily",
  },

  // ===== mart_webinar_events — remaining (covered by Phase B InfoTips) =====

  cash_collected: {
    key: "cash_collected",
    label: "Cash Collected",
    description:
      "Upfront cash banked from deals attributed to this webinar's booking week (Fanbasis at-close payment only — no payment-plan installments).",
    formula: "SUM(cash_collected) over deals tied to this webinar",
    source: "int_calls_enriched → mart_webinar_events.cash_collected",
  },
  revenue_generated: {
    key: "revenue_generated",
    label: "Revenue Generated",
    description:
      "Total Contract Value (TCV) of deals closed from this webinar — includes payment-plan installments not yet collected.",
    formula: "SUM(revenue_generated) over deals tied to this webinar",
    source: "int_calls_enriched → mart_webinar_events.revenue_generated",
  },
  revenue_predicted: {
    key: "revenue_predicted",
    label: "Revenue Predicted",
    description:
      "Predicted revenue from deposit-takers (deposit-only rows where the close hasn't happened yet).",
    formula: "SUM(revenue_predicted) over deposit rows tied to this webinar",
    source: "int_calls_enriched → mart_webinar_events.revenue_predicted",
  },
  deposit_collected: {
    key: "deposit_collected",
    label: "Deposit Collected",
    description:
      "Dollar value of deposits taken on this webinar's calls — prospects who put money down but haven't closed yet.",
    formula: "SUM(deposit_collected) WHERE is_deposit",
    source: "int_calls_enriched → mart_webinar_events.deposit_collected",
  },
  deals_closed: {
    key: "deals_closed",
    label: "Deals Closed",
    description:
      "Number of closed-won deals attributed to this webinar's booking week.",
    formula: "COUNTIF(is_deal) over rows tied to this webinar",
    source: "int_calls_enriched → mart_webinar_events.deals_closed",
  },
  webinar_deposits: {
    key: "webinar_deposits",
    label: "Deposits",
    description:
      "Number of deposit rows from this webinar — prospects in the close pipeline who put money down.",
    formula: "COUNTIF(is_deposit) over rows tied to this webinar",
    source: "mart_webinar_events.webinar_deposits",
  },
  calls_booked: {
    key: "calls_booked",
    label: "Calls Booked",
    description:
      "Strategy-call Calendly bookings attributable to this webinar's booking week, including bookings later canceled.",
    formula: "COUNTIF(is_call_booked) over rows tied to this webinar",
    source: "stg_calendly → mart_webinar_events.calls_booked",
  },
  calls_booked_active: {
    key: "calls_booked_active",
    label: "Active Booked Calls",
    description:
      "Booked calls that weren't canceled before they could be held. Dynamic — drops as cancellations happen.",
    formula: "calls_booked WHERE is_canceled = FALSE",
    source: "mart_webinar_events.calls_booked_active",
  },
  pitch_to_book_rate: {
    key: "pitch_to_book_rate",
    label: "Pitch → Book Rate",
    description:
      "Share of pitched attendees who booked a strategy call afterwards.",
    formula: "calls_booked / pitched_attendees",
    source: "mart_webinar_events.pitch_to_book_rate",
  },

  // ----- Funnel -----
  lp_page_views: {
    key: "lp_page_views",
    label: "Page Views",
    description:
      "Landing-page visits — top of the funnel before opt-in.",
    formula: "COUNT(events) on the webinar landing page",
    source: "GHL → mart_webinar_events.lp_page_views",
  },
  lp_opt_ins: {
    key: "lp_opt_ins",
    label: "Opt-ins",
    description:
      "Email opt-ins on the landing page — anyone who handed over an address, registered or not.",
    formula: "COUNTIF(opt_in)",
    source: "GHL → mart_webinar_events.lp_opt_ins",
  },
  lp_opt_in_rate: {
    key: "lp_opt_in_rate",
    label: "Opt-in Rate",
    description: "Landing page conversion to opt-in.",
    formula: "lp_opt_ins / lp_page_views",
    source: "mart_webinar_events.lp_opt_in_rate",
  },
  lp_form_submissions: {
    key: "lp_form_submissions",
    label: "Form Submissions",
    description:
      "Completed registration forms — opt-in + filled out the GHL registration form.",
    formula: "COUNTIF(form_submitted)",
    source: "GHL → mart_webinar_events.lp_form_submissions",
  },
  total_registrants: {
    key: "total_registrants",
    label: "Total Registrants",
    description:
      "All sources combined — Meta + TikTok + ManyChat + Setter + Other.",
    formula:
      "meta + tiktok + manychat + setter + other_organic registrants",
    source: "mart_webinar_events.total_registrants",
  },
  unique_attendees: {
    key: "unique_attendees",
    label: "Unique Attendees",
    description:
      "Distinct people who actually joined the Zoom session live.",
    formula: "COUNT(DISTINCT attendee_email) from Zoom attendance",
    source: "stg_zoom_webinar_attendance → mart_webinar_events.unique_attendees",
  },
  pitched_attendees: {
    key: "pitched_attendees",
    label: "Pitched Attendees",
    description:
      "Live attendees who stayed long enough to hear the offer pitch.",
    formula: "attendees with watch-time past the pitch threshold",
    source: "stg_zoom_webinar_attendance → mart_webinar_events.pitched_attendees",
  },
  reg_to_attend_rate: {
    key: "reg_to_attend_rate",
    label: "Reg → Attend Rate",
    description:
      "Share of registrants who actually showed up live.",
    formula:
      "unique_attendees / total_registrants (legacy rows: lp_opt_ins)",
    source: "mart_webinar_events.reg_to_attend_rate",
  },
  attend_to_pitched_rate: {
    key: "attend_to_pitched_rate",
    label: "Attend → Pitch Rate",
    description: "Share of attendees who stuck around for the pitch.",
    formula: "pitched_attendees / unique_attendees",
    source: "mart_webinar_events.attend_to_pitched_rate",
  },

  // ----- Meta funnel -----
  meta_impressions: {
    key: "meta_impressions",
    label: "Impressions",
    description:
      "Meta ad impressions for webinar Registration campaigns (Hammer-Them excluded). Fractional on Sunday-split weeks.",
    formula: "SUM(impressions) WHERE campaign_category = 'webinar_registration'",
    source: "raw_meta basic_campaign → mart_webinar_events.meta_impressions",
  },
  meta_ctr: {
    key: "meta_ctr",
    label: "Meta CTR",
    description:
      "Link-click-through rate — outbound link clicks per impression. Registration campaigns only.",
    formula: "meta_link_clicks / meta_impressions",
    source: "mart_webinar_events.meta_ctr",
  },
  meta_cvr: {
    key: "meta_cvr",
    label: "Meta CVR",
    description:
      "Reported conversions per link click (Meta's reported number, not server-side).",
    formula: "meta_reported_conversions / meta_link_clicks",
    source: "mart_webinar_events.meta_cvr",
  },
  meta_cpl: {
    key: "meta_cpl",
    label: "Meta CPL",
    description:
      "Cost per registration-campaign lead — registration spend divided by reported conversions.",
    formula: "webinar_reg_ad_spend / meta_reported_conversions",
    source: "mart_webinar_events.meta_cpl",
  },
  paid_cpr: {
    key: "paid_cpr",
    label: "Paid CPR",
    description:
      "Paid cost per Meta-attributed registrant — registration spend per Meta registrant only (excludes organic).",
    formula: "webinar_reg_ad_spend / meta_registrants",
    source: "mart_webinar_events.paid_cpr",
  },
  blended_cpa: {
    key: "blended_cpa",
    label: "Blended CPA",
    description:
      "Total webinar spend per live attendee — Cost Per Attendee.",
    formula: "total_webinar_ad_spend / unique_attendees",
    source: "mart_webinar_events.blended_cpa",
  },
  blended_cpbc: {
    key: "blended_cpbc",
    label: "Blended CPBC",
    description:
      "Total webinar spend per booked call (all bookings, including cancellations).",
    formula: "total_webinar_ad_spend / calls_booked",
    source: "mart_webinar_events.blended_cpbc",
  },

  // ----- Registration sources -----
  meta_registrants: {
    key: "meta_registrants",
    label: "Meta Registrants",
    description: "Registrants attributed to Meta paid campaigns.",
    formula: "COUNTIF(traffic_source = 'meta')",
    source: "GHL → mart_webinar_events.meta_registrants",
  },
  tiktok_registrants: {
    key: "tiktok_registrants",
    label: "TikTok Registrants",
    description: "Registrants attributed to TikTok ads.",
    formula: "COUNTIF(traffic_source = 'tiktok')",
    source: "GHL → mart_webinar_events.tiktok_registrants",
  },
  manychat_registrants: {
    key: "manychat_registrants",
    label: "ManyChat Registrants",
    description: "Registrants who came in through the ManyChat IG/Messenger flow.",
    formula: "COUNTIF(traffic_source = 'manychat')",
    source: "GHL → mart_webinar_events.manychat_registrants",
  },
  setter_registrants: {
    key: "setter_registrants",
    label: "Setter Registrants",
    description:
      "Registrants brought in directly by a setter's outreach (DM-to-webinar flow).",
    formula: "COUNTIF(traffic_source = 'setter')",
    source: "mart_webinar_events.setter_registrants",
  },
  other_organic_registrants: {
    key: "other_organic_registrants",
    label: "Other / Organic",
    description:
      "Registrants from any other source — affiliates, organic search, word-of-mouth.",
    formula: "COUNTIF(traffic_source NOT IN known list)",
    source: "mart_webinar_events.other_organic_registrants",
  },

  // ===== mart_high_level_daily — remaining =====

  total_calls_booked_active: {
    key: "total_calls_booked_active",
    label: "Active Booked Calls",
    description:
      "Strategy-call bookings that weren't canceled. Dynamic — drops as cancellations happen.",
    formula: "total_calls_booked WHERE is_canceled = FALSE",
    source: "mart_high_level_daily.total_calls_booked_active",
  },
  total_deals_closed: {
    key: "total_deals_closed",
    label: "Total Deals Closed",
    description:
      "Distinct deal-prospects who closed on date_closed.",
    formula: "COUNT(DISTINCT prospect_email_lc) WHERE is_deal",
    source: "int_calls_enriched → mart_high_level_daily.total_deals_closed",
  },
  cost_per_booked_call: {
    key: "cost_per_booked_call",
    label: "Cost Per Booked Call",
    description:
      "Ad spend per strategy-call booking — across ALL Meta campaigns, not just webinar.",
    formula: "SUM(total_ad_spend) / SUM(total_calls_booked)",
    source: "mart_high_level_daily",
  },
  cash_per_booked_call: {
    key: "cash_per_booked_call",
    label: "Cash Per Booked Call",
    description:
      "Cash collected per booked call — the inverse-direction efficiency vs Cost Per Booked Call.",
    formula: "SUM(total_cash_collected) / SUM(total_calls_booked)",
    source: "mart_high_level_daily",
  },
  roas_tcc: {
    key: "roas_tcc",
    label: "ROAS (TCC)",
    description:
      "Total Cash Collected return on ad spend across the period.",
    formula: "SUM(total_cash_collected) / SUM(total_ad_spend)",
    source: "mart_high_level_daily",
  },
  roas_tcv: {
    key: "roas_tcv",
    label: "ROAS (TCV)",
    description:
      "Total Contracted Value (deposit + payment plans) return on ad spend.",
    formula: "SUM(total_revenue_contracted) / SUM(total_ad_spend)",
    source: "mart_high_level_daily",
  },
  aov: {
    key: "aov",
    label: "AOV",
    description:
      "Average upfront cash per deal (Average Order Value on cash).",
    formula: "SUM(total_cash_collected) / SUM(total_deals_closed)",
    source: "mart_high_level_daily",
  },
  acv: {
    key: "acv",
    label: "ACV",
    description:
      "Average contracted value per deal (full deal size, including payment-plan installments).",
    formula: "SUM(total_revenue_contracted) / SUM(total_deals_closed)",
    source: "mart_high_level_daily",
  },

  // ----- Sales-cycle medians (computed JS-side) -----
  median_booking_to_close_occ: {
    key: "median_booking_to_close_occ",
    label: "Median Booking → Close (OCC)",
    description:
      "Median days from Calendly booking to date_closed for one-call-closes. Half the OCC deals close faster than this; half slower.",
    formula: "MEDIAN(booking_to_close_days) WHERE close_type = 'OCC'",
    sql: "-- close_type='OCC' := is_deal AND held_call_number = 1",
    source: "int_calls_enriched",
  },
  median_first_call_to_close_fuc: {
    key: "median_first_call_to_close_fuc",
    label: "Median 1st Call → Close (FUC)",
    description:
      "Median days from a prospect's first ever genuine show-up to date_closed, for follow-up closes.",
    formula: "MEDIAN(first_call_to_close_days) WHERE close_type = 'FUC'",
    sql: "-- close_type='FUC' := is_deal AND held_call_number > 1",
    source: "int_calls_enriched",
  },
};

export function getMetricDef(key: string): MetricDef | null {
  return METRIC_DEFS[key] ?? null;
}
