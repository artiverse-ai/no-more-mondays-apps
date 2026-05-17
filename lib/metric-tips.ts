// Hover tooltips for every metric across the Monday + Thursday weekly reports.
// Strings copied verbatim from the HTML mockups (NMM_Monday_Report_*.html /
// NMM_Thursday_Report_*.html, `class="tip" dt="..."` attributes). Multi-line
// definitions use \n — the TooltipLayer renders with white-space:pre-line so
// newlines preserve as line-breaks. Numbers in examples are illustrative
// (from May 3–9 / May 13 weeks) and not meant to be exact today.
//
// Consumed by:
//   - PersistentKpiStrip.tsx
//   - Tab1Overview.tsx (Section A/B/C cards + funnel labels)
//   - Tab2LatestWebinar.tsx (channel mix + meta campaigns)
//   - Tab3LastWeekSales.tsx (Monday-only — funnel + tables)

export const TIP = {
  // --- Persistent KPI strip (§2) -----------------------------------------
  avgWebinarShowRate:
    "SUM(unique_attendees) / SUM(total_registrants)\n" +
    "Scope: last 3 Sun/Wed webinars anchored on latest_webinar_date\n" +
    "(weighted by registrant volume — always includes the just-happened webinar).\n" +
    "Source: mart_webinar_events",
  pctTierOneLeads:
    "tier_one_submissions / form_submissions\n" +
    "Source: mart_webinar_events (PENDING — fields not yet ingested)",
  blendedCashRoas:
    "SUM(stg_fanbasis_sales.amount_usd WHERE status='succeeded') / SUM(mart_high_level_daily.total_ad_spend)\n" +
    "Window: prev Sun-Sat",
  cplBlended:
    "SUM(total_ad_spend) / SUM(<blended_leads_denominator>)\n" +
    "Denominator TBD (Open Item §11.2). Rendered N/A until confirmed.",
  cashPerBookedCall:
    "SUM(stg_fanbasis_sales.amount_usd) / SUM(mart_high_level_daily.total_calls_booked)\n" +
    "Sergio's KPI: Dollars Per Call (DPC)\n" +
    "Source: stg_fanbasis_sales + mart_high_level_daily",

  // --- Section A · money (§3.1) ------------------------------------------
  cashCollected:
    "SUM(amount_usd) WHERE status='succeeded'\n" +
    "Window: sale_date in the KPI window\n" +
    "Source: stg_fanbasis_sales (Fanbasis + Whop)",
  revenueTcv:
    "SUM(total_revenue_contracted)\n" +
    "Window: date_closed in the KPI window\n" +
    "Source: mart_high_level_daily → int_calls_enriched",
  roasCash:
    "Fanbasis cash / total ad spend",
  roasTcv:
    "TCV / total ad spend",
  adSpendBlended:
    "SUM(total_ad_spend) — ALL Meta campaigns (reg + hammer-them + monthly + book-a-call + other)\n" +
    "Source: mart_high_level_daily → stg_meta_campaigns",
  dealsClosed:
    "SUM(total_deals_closed)\n" +
    "Window: date_closed in the KPI window\n" +
    "Source: mart_high_level_daily",
  aov:
    "Fanbasis cash / Deals",
  acv:
    "TCV / Deals",
  pifRate:
    "count_pif_deals / total_deals\n" +
    "is_paid_in_full = is_deal AND cash_collected >= revenue_generated.\n" +
    "Sergio's leading indicator of closer quality.\n" +
    "Source: mart_high_level_daily",
  cashCollectionRate:
    "Fanbasis cash / TCV\n" +
    "Measures upfront vs payment-plan mix.",

  // --- Section A · sales cycle (§3.2) ------------------------------------
  medianBookToCloseOcc:
    "MEDIAN booking_to_close_days WHERE close_type='OCC' (Off-Call Close — closed on the call held).\n" +
    "Window: date_closed in the KPI window\n" +
    "Source: int_calls_enriched",
  avgBookToCloseOcc:
    "AVG booking_to_close_days WHERE close_type='OCC'\n" +
    "Window: date_closed in the KPI window\n" +
    "Source: int_calls_enriched\n\n" +
    "Note: Average may be pulled higher than median by outliers.",
  medianFirstCallToCloseFuc:
    "MEDIAN first_call_to_close_days WHERE close_type='FUC' (Follow-Up Close — closed on a later call).\n" +
    "Window: date_closed in the KPI window\n" +
    "Source: int_calls_enriched",
  avgFirstCallToCloseFuc:
    "AVG first_call_to_close_days WHERE close_type='FUC'\n" +
    "Window: date_closed in the KPI window\n" +
    "Source: int_calls_enriched",

  // --- Section B · marketing efficiency (§4) -----------------------------
  totalCallsBooked:
    "SUM(total_calls_booked) — Calendly strategy calls only, deduped by email\n" +
    "Window: created_date in the KPI window\n" +
    "Source: mart_high_level_daily → stg_calendly",
  costPerBookedCall:
    "Total ad spend / total calls booked\n" +
    "Source: mart_high_level_daily",

  // --- Section C · funnel stages (§5) ------------------------------------
  funnelProspects:
    "COUNT DISTINCT prospect_email_lc\n" +
    "DATE(appointment_date_time) in the KPI window\n" +
    "Source: int_calls_enriched",
  funnelProspectsSq:
    "Setter-Qualified\n" +
    "COUNT DISTINCT WHERE is_show_rate_eligible",
  funnelShows:
    "Setter-Qualified Show-Ups (was 'Shows (SQ)' label)\n" +
    "COUNT DISTINCT WHERE is_show_up",
  funnelQualifiedShows:
    "Closer-Qualified Show-Ups (was 'Shows (CQ)' label)\n" +
    "COUNT DISTINCT WHERE is_close_rate_eligible",
  funnelDeals:
    "COUNT DISTINCT WHERE is_deal",

  // --- Section C · funnel rates (§6) -------------------------------------
  showRate:
    "Shows / Prospects (SQ)\n" +
    "Source: int_calls_enriched is_show_up / is_show_rate_eligible",
  closeRateShows:
    "Deals / Shows\n" +
    "Denominator: ALL setter-qualified show-ups (broader than Close Rate CQ).\n" +
    "Source: int_calls_enriched (is_deal AND is_close_rate_eligible) / is_show_up",
  closeRateCq:
    "Deals / Qualified Shows\n" +
    "Denominator: Closer-qualified show-ups (Closer DQ removed).\n" +
    "Source: int_calls_enriched (is_deal AND is_close_rate_eligible) / is_close_rate_eligible",
  setterDqRate:
    "Setter DQ / Prospects (D'd)\n" +
    "Source: mart_high_level_daily",
  closerDqRate:
    "Closer DQ / Shows (SQ)\n" +
    "Source: mart_high_level_daily",

  // --- Section C · prospect efficiency (§6.2) ----------------------------
  ddToCq:
    "Qualified Shows / Prospects (D'd)\n" +
    "Compresses the full setter-to-closer chain into one rate.",
  ddToClose:
    "Deals / Prospects (D'd)\n" +
    "Full funnel conversion: every dispositioned prospect that ends up as a closed deal.",
  dollarsCcPerPdd:
    "SUM(cash_collected WHERE is_deal) / COUNT_DISTINCT(prospect_email_lc WHERE is_dispositioned)\n" +
    "How much cash is generated for every prospect who receives a disposition.",
  dollarsCcPerShowsSq:
    "SUM(cash_collected WHERE is_deal) / COUNT_DISTINCT(prospect_email_lc WHERE is_show_up)\n" +
    "How much cash is generated per prospect who genuinely shows up.",
  dollarsTcvPerPdd:
    "SUM(revenue_generated WHERE is_deal) / COUNT_DISTINCT(prospect_email_lc WHERE is_dispositioned)\n" +
    "Total contract value per dispositioned prospect. Higher than CC variant — counts full payment-plan value.",
  dollarsTcvPerShowsSq:
    "SUM(revenue_generated WHERE is_deal) / COUNT_DISTINCT(prospect_email_lc WHERE is_show_up)\n" +
    "Total contract value per genuine show-up.",

  // --- Tab 2 — Latest Webinar (§4 / Thursday §6) -------------------------
  totalRegistrantsGhl:
    "GHL form-submission count.\n" +
    "Source: mart_webinar_events.total_registrants → stg_ghl_weekly_webinar_regs",
  uniqueAttendees:
    "Unique Zoom attendees (best session, deduped by email).\n" +
    "Source: mart_webinar_events.unique_attendees",
  attendRateRegToZoom:
    "Unique Attendees / Total Registrants (GHL basis).\n" +
    "Source: mart_webinar_events.reg_to_attend_rate",
  pitchedAttendees:
    "Attendees with >25min cumulative duration.\n" +
    "Source: mart_webinar_events.pitched_attendees",
  pitchRate:
    "pitched_attendees / unique_attendees\n" +
    "Source: mart_webinar_events.attend_to_pitched_rate",
  callsBookedTotal:
    "Total Calendly bookings (Sun-night → Tue window for Sun webinar).\n" +
    "Source: mart_webinar_events.calls_booked",
  callsBookedActive:
    "Non-canceled bookings (dynamic).\n" +
    "Source: mart_webinar_events.calls_booked_active",
  showsHeld:
    "Calls actually held.\n" +
    "Source: mart_webinar_events.shows",
  dealsCycle:
    "COUNT DISTINCT is_deal.\n" +
    "Source: mart_webinar_events.deals_closed",
  cashCollectedPerAttendee:
    "cash_collected / unique_attendees\n" +
    "Source: mart_webinar_events.cash_collected_per_attendee",
  contractValuePerAttendee:
    "revenue_generated / unique_attendees\n" +
    "Source: mart_webinar_events.contract_value_per_attendee",
  adSpendMart:
    "Ad spend attributed to webinar promo window.\n" +
    "Sun: Thu+Fri+Sat + ½·Sun.\n" +
    "Source: mart_webinar_events.total_webinar_ad_spend",
  costPerAttendee:
    "total_webinar_ad_spend / unique_attendees\n" +
    "Source: mart_webinar_events.blended_cpa",
  costPerActiveBookedCall:
    "total_webinar_ad_spend / calls_booked_active\n" +
    "Non-canceled bookings (dynamic).\n" +
    "Source: mart_webinar_events.blended_cpbc_active",
  costPerQualifiedShow:
    "total_webinar_ad_spend / qualified_shows (CQ)\n" +
    "Source: mart_webinar_events.blended_cost_per_qualified_show",
  costPerRegPaid:
    "webinar_reg_ad_spend / meta_registrants\n" +
    "Source: mart_webinar_events.paid_cpr",
  cac:
    "ad_spend / deals_closed.\n" +
    "Source: mart_webinar_events.cac",
  metaImpressions:
    "SUM(impressions) across webinar_registration campaigns in promo window.\n" +
    "Source: mart_webinar_events.meta_impressions",
  metaLinkClicks:
    "SUM(link_clicks) across webinar_registration campaigns in promo window.\n" +
    "Note: link clicks only — not total clicks.\n" +
    "Source: mart_webinar_events.meta_link_clicks",
  metaCtr:
    "link_clicks / impressions (link-based CTR, NOT total-clicks CTR).\n" +
    "Source: mart_webinar_events.meta_ctr",
  metaReportedConv:
    "Meta-reported pixel conversions for webinar_registration campaigns. NOT GHL-tagged registrants.\n" +
    "Source: mart_webinar_events.meta_reported_conversions",
  metaCvr:
    "conversions / link_clicks (link-based CVR).\n" +
    "Source: mart_webinar_events.meta_cvr",
  metaCpl:
    "webinar_reg_ad_spend / meta_reported_conversions\n" +
    "Source: mart_webinar_events.meta_cpl",
  lpPageViews:
    "Landing page views.\n" +
    "Source: mart_webinar_events.lp_page_views (Google Sheet feed)",
  lpOptIns:
    "Absolute LP opt-in count.\n" +
    "Source: mart_webinar_events.lp_opt_ins (Google Sheet feed)",
  lpOptInRate:
    "lp_opt_ins / lp_page_views\n" +
    "Source: mart_webinar_events.lp_opt_in_rate",
  reactivationPool:
    "No-show contacts targeted for reactivation.\n" +
    "Source: mart_webinar_events.reactivation_pool_size",
  reactivationBooked:
    "Pool contacts who booked within 7 days of webinar.\n" +
    "Source: mart_webinar_events.reactivations_booked",
  reactivationAttended:
    "Pool contacts who attended (Zoom email match).\n" +
    "Source: mart_webinar_events.reactivations_attended",
  metaFrequency:
    "SUM(impressions) / MAX(daily reach) over the window.\n" +
    "Approximation of how many times the average reached person saw the ad.\n" +
    ">3× typically indicates audience saturation risk; >5× = high saturation.\n" +
    "Source: stg_meta_campaigns",

  // --- Tab 3 (Monday) — Closer / Setter / Booking-mode tables ------------
  tbl_prospects: "COUNT DISTINCT prospect_email_lc",
  tbl_dd: "Prospects (D'd) — dispositioned by this closer's setter",
  tbl_sDq: "Setter DQ count on this closer's assigned prospects",
  tbl_sDqPct: "Setter DQ / Pros (D'd)",
  tbl_cDq: "Closer DQ — this closer DQ'd the prospect on call",
  tbl_cDqPct: "Closer DQ / Shows",
  tbl_sq: "Prospects (SQ) — Setter-Qualified for this closer",
  tbl_shows: "Setter-Qualified Show-Ups (was 'Shows (SQ)' label)",
  tbl_showPct: "Shows / Pros (SQ)",
  tbl_qShows: "Closer-Qualified Show-Ups (display: Qualified Shows)",
  tbl_closeShowsPct: "Deals / Shows (broader denominator)",
  tbl_closeCqPct: "Deals / Qualified Shows (CQ basis)",
  tbl_deals: "COUNT DISTINCT WHERE is_deal",
  tbl_cash:
    "SUM cash_collected WHERE is_deal\n" +
    "Source: int_calls_enriched",
  tbl_ttb:
    "MEDIAN time-to-book in days\n" +
    "MEDIAN DATE_DIFF(calendly_created_ts, ghl_lead_created_date, DAY)\n" +
    "NULL when no GHL match (cold setter contacts)",
  tbl_bonus: "$300/week bonus thresholds: 80%+ combined SR AND 20+ combined Pros (SQ)",
  tbl_modeSetter:
    "is_setter_flow = true\n" +
    "final_marketing_flow = 'Setter Booked'",
  tbl_modeWebinar:
    "is_webinar_flow = true\n" +
    "final_marketing_flow IN ('Wednesday Webinar','Webinar','Post-Attendee Webinar Typeform')",
} as const;

export type TipKey = keyof typeof TIP;
