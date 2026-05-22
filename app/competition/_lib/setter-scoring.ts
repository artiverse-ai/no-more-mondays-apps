// Setter leaderboard for the competition. Setters score INDIVIDUALLY:
// 100 points per booked call. We also surface show rate and close rate
// on the calls they own. Data is grouped straight off
// int_calls_enriched (no setter mart exists) — same source as the
// Setter Performance dashboard.
//
// Bookings are grouped by booking date so special-day point
// multipliers apply per date (a booking on a 2× day is worth 200 not
// 100). Show/close rates are unaffected by multipliers — they're rates.

import { bq } from "@/lib/bq";
import { periodWindow, type Period } from "./scoring";
import { fetchPointMultipliers, todayEt } from "./multipliers";
import {
  SETTER_ROSTER,
  POINTS_PER_BOOKING,
  type SetterProfile,
} from "../_data/setters";

const ENRICHED = "`no-more-mondays-analytics.dbt_tuddin.int_calls_enriched`";

export type SetterScore = {
  profile: SetterProfile;
  bookings: number;
  points: number; // Σ bookings/day × POINTS_PER_BOOKING × that day's multiplier
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
  /** Point multiplier in effect for today's ET date (1 = normal). */
  todayMultiplier: number;
};

// Per setter PER DAY — the day grain lets multipliers apply by date.
//
// Dated by created_date — when the call was BOOKED, not when it's
// scheduled. A setter earns points the moment they book; a call booked
// before launch but scheduled after must NOT count. (Filtering by the
// appointment date wrongly credited pre-launch bookings.) The period
// window is already floored at COMPETITION_START.
const SETTER_SQL = `
  SELECT
    COALESCE(setter_owner, calendly_setter_name) AS setter,
    FORMAT_DATE('%F', created_date)              AS booked_date,
    COUNTIF(is_call_booked)            AS bookings,
    COUNTIF(is_show_up)                AS show_ups,
    COUNTIF(is_show_rate_eligible)     AS show_rate_eligible,
    COUNTIF(is_deal)                   AS deals
  FROM ${ENRICHED}
  WHERE created_date BETWEEN DATE(@start) AND DATE(@end)
    AND COALESCE(setter_owner, calendly_setter_name) IN UNNEST(@setters)
  GROUP BY setter, booked_date
`;

type Acc = {
  bookings: number;
  points: number;
  showUps: number;
  showRateEligible: number;
  deals: number;
};

export async function fetchSetterLeaderboard(
  period: Period,
  now: Date = new Date(),
): Promise<SetterLeaderboard> {
  const { start, end } = periodWindow(period, now);
  const [rowsRaw, multipliers] = await Promise.all([
    bq().query({
      query: SETTER_SQL,
      params: { start, end, setters: SETTER_ROSTER.map((s) => s.setter) },
      types: { start: "STRING", end: "STRING", setters: ["STRING"] },
    }),
    fetchPointMultipliers(),
  ]);
  const rows = rowsRaw[0] as Array<Record<string, unknown>>;
  const multFor = (d: string) => multipliers.get(d) ?? 1;
  const num = (v: unknown) => Number(v ?? 0);

  const acc = new Map<string, Acc>();
  for (const profile of SETTER_ROSTER) {
    acc.set(profile.setter, {
      bookings: 0,
      points: 0,
      showUps: 0,
      showRateEligible: 0,
      deals: 0,
    });
  }
  for (const r of rows) {
    const a = acc.get(String(r.setter ?? ""));
    if (!a) continue;
    const bookings = num(r.bookings);
    a.bookings += bookings;
    a.points += Math.round(
      bookings * POINTS_PER_BOOKING * multFor(String(r.booked_date ?? "")),
    );
    a.showUps += num(r.show_ups);
    a.showRateEligible += num(r.show_rate_eligible);
    a.deals += num(r.deals);
  }

  const setters: SetterScore[] = SETTER_ROSTER.map((profile) => {
    const a = acc.get(profile.setter)!;
    return {
      profile,
      bookings: a.bookings,
      points: a.points,
      showUps: a.showUps,
      showRateEligible: a.showRateEligible,
      showRate: a.showRateEligible > 0 ? a.showUps / a.showRateEligible : null,
      deals: a.deals,
      closeRate: a.showUps > 0 ? a.deals / a.showUps : null,
      rank: 0,
    };
  }).sort((x, y) => y.points - x.points);

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
    todayMultiplier: multFor(todayEt()),
  };
}
