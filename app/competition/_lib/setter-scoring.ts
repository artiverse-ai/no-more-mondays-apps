// Setter leaderboard for the competition. Setters score INDIVIDUALLY:
// 100 points per booked call. We also surface show rate and close rate
// on the calls they own. Data is grouped straight off
// int_calls_enriched (no setter mart exists) — same source as the
// Setter Performance dashboard.

import { bq } from "@/lib/bq";
import { periodWindow, type Period } from "./scoring";
import {
  SETTER_ROSTER,
  POINTS_PER_BOOKING,
  type SetterProfile,
} from "../_data/setters";

const ENRICHED = "`no-more-mondays-analytics.dbt_tuddin.int_calls_enriched`";

export type SetterScore = {
  profile: SetterProfile;
  bookings: number;
  points: number; // bookings × POINTS_PER_BOOKING
  showUps: number;
  showRateEligible: number;
  /** showUps / showRateEligible — null when nothing is eligible yet. */
  showRate: number | null;
  deals: number;
  /** deals / showUps — close rate on calls they own. Null pre-shows. */
  closeRate: number | null;
  /** 1-based rank by points. */
  rank: number;
};

export type SetterLeaderboard = {
  period: Period;
  windowStart: string;
  windowEnd: string;
  fetchedAt: string;
  setters: SetterScore[]; // ranked, points DESC
  totalBookings: number;
};

// Bookings dated by appointment_date_time (the call date) — same window
// logic the Setter Performance dashboard uses. Restricted to the three
// competing setters; the period window is already floored at
// COMPETITION_START by periodWindow().
const SETTER_SQL = `
  SELECT
    COALESCE(setter_owner, calendly_setter_name) AS setter,
    COUNTIF(is_call_booked)            AS bookings,
    COUNTIF(is_show_up)                AS show_ups,
    COUNTIF(is_show_rate_eligible)     AS show_rate_eligible,
    COUNTIF(is_deal)                   AS deals
  FROM ${ENRICHED}
  WHERE appointment_date_time IS NOT NULL
    AND DATE(appointment_date_time) BETWEEN DATE(@start) AND DATE(@end)
    AND COALESCE(setter_owner, calendly_setter_name) IN UNNEST(@setters)
  GROUP BY setter
`;

export async function fetchSetterLeaderboard(
  period: Period,
  now: Date = new Date(),
): Promise<SetterLeaderboard> {
  const { start, end } = periodWindow(period, now);
  const [rows] = await bq().query({
    query: SETTER_SQL,
    params: { start, end, setters: SETTER_ROSTER.map((s) => s.setter) },
    types: { start: "STRING", end: "STRING", setters: ["STRING"] },
  });

  const byName = new Map<string, Record<string, unknown>>();
  for (const r of rows as Array<Record<string, unknown>>) {
    byName.set(String(r.setter ?? ""), r);
  }
  const num = (v: unknown) => Number(v ?? 0);

  const setters: SetterScore[] = SETTER_ROSTER.map((profile) => {
    const r = byName.get(profile.setter);
    const bookings = num(r?.bookings);
    const showUps = num(r?.show_ups);
    const showRateEligible = num(r?.show_rate_eligible);
    const deals = num(r?.deals);
    return {
      profile,
      bookings,
      points: bookings * POINTS_PER_BOOKING,
      showUps,
      showRateEligible,
      showRate: showRateEligible > 0 ? showUps / showRateEligible : null,
      deals,
      closeRate: showUps > 0 ? deals / showUps : null,
      rank: 0,
    };
  }).sort((a, b) => b.points - a.points);

  setters.forEach((s, i) => {
    s.rank = i + 1;
  });

  return {
    period,
    windowStart: start,
    windowEnd: end,
    fetchedAt: new Date().toISOString(),
    setters,
    totalBookings: setters.reduce((sum, s) => sum + s.bookings, 0),
  };
}
