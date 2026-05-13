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
};

export function getMetricDef(key: string): MetricDef | null {
  return METRIC_DEFS[key] ?? null;
}
