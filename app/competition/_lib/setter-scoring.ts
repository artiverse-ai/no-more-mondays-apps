// Setter leaderboard for the competition.
//
// Scoring (per Sergio 2026-05-24): setters earn points the same way
// closers do — every $10 of cash collected = 1 pt — but on the cash
// from the calls they BOOKED. So they're incentivised both to book
// more calls AND that those bookings close.
//
// The day of the BOOKING carries the multiplier (a booking on a 2× day
// pays double once the call closes). That aligns the bonus with the
// action the setter actually controls — the closer's close date
// already determines their own multiplier separately.
//
// Show rate and close rate on the calls they own are also surfaced as
// quality stats. Data is grouped straight off int_calls_enriched.

import { bq } from "@/lib/bq";
import { periodWindow, type Period } from "./scoring";
import { fetchPointMultipliers, todayEt } from "./multipliers";
import { SETTER_ROSTER, type SetterProfile } from "../_data/setters";
import { COMPETITION_LAUNCH_TS } from "../_data/roster";

const ENRICHED = "`no-more-mondays-analytics.dbt_tuddin.int_calls_enriched`";

export type SetterScore = {
  profile: SetterProfile;
  bookings: number;
  /** Cash from deals among the setter's bookings, in the window. */
  cashCollected: number;
  /** floor(cash/10) × multiplier(booking date), summed per day. */
  points: number;
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
  totalCash: number;
  /** Point multiplier in effect for today's ET date (1 = normal). */
  todayMultiplier: number;
};

// Per Marek 2026-05-26: setters get credit for any deal that closes
// in the window, regardless of when the underlying call was booked.
// Mirrors the closer-side change. Booking-side stats (bookings,
// shows, show-rate) keep the post-launch booking filter — those
// measure the setter's current hustle, not lagging deal flow.
//
// Implemented as two unioned queries, distinguished by row_type:
//   - 'booking': counts/stats for post-launch bookings in the period.
//     Used for `bookings`, `show_ups`, `show_rate_eligible`.
//   - 'deal':    deals + cash for any close in the period, no booking
//     filter. Used for `deals` and `cash_collected`. Day = close_date
//     so multipliers apply on the close.
const SETTER_SQL = `
  SELECT
    COALESCE(setter_owner, calendly_setter_name) AS setter,
    'booking'                                    AS row_type,
    FORMAT_DATE('%F', DATE(calendly_created_ts, 'America/New_York')) AS day,
    COUNTIF(is_call_booked)            AS bookings,
    COUNTIF(is_show_up)                AS show_ups,
    COUNTIF(is_show_rate_eligible)     AS show_rate_eligible,
    0                                  AS deals,
    CAST(0 AS NUMERIC)                 AS cash_collected
  FROM ${ENRICHED}
  WHERE calendly_created_ts IS NOT NULL
    AND calendly_created_ts >= TIMESTAMP(@launchTs)
    AND DATE(calendly_created_ts, 'America/New_York') BETWEEN DATE(@start) AND DATE(@end)
    AND COALESCE(setter_owner, calendly_setter_name) IN UNNEST(@setters)
  GROUP BY setter, day

  UNION ALL

  SELECT
    COALESCE(setter_owner, calendly_setter_name) AS setter,
    'deal'                                       AS row_type,
    FORMAT_DATE('%F', date_closed)               AS day,
    0                                  AS bookings,
    0                                  AS show_ups,
    0                                  AS show_rate_eligible,
    COUNT(*)                           AS deals,
    SUM(CAST(cash_collected AS NUMERIC)) AS cash_collected
  FROM ${ENRICHED}
  WHERE is_deal
    AND date_closed BETWEEN DATE(@start) AND DATE(@end)
    AND COALESCE(setter_owner, calendly_setter_name) IN UNNEST(@setters)
  GROUP BY setter, day
`;

type Acc = {
  bookings: number;
  cashCollected: number;
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
      params: {
        start,
        end,
        launchTs: COMPETITION_LAUNCH_TS,
        setters: SETTER_ROSTER.map((s) => s.setter),
      },
      types: { start: "STRING", end: "STRING", launchTs: "STRING", setters: ["STRING"] },
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
      cashCollected: 0,
      points: 0,
      showUps: 0,
      showRateEligible: 0,
      deals: 0,
    });
  }
  for (const r of rows) {
    const a = acc.get(String(r.setter ?? ""));
    if (!a) continue;
    const cash = num(r.cash_collected);
    // `day` is the booking date on 'booking' rows (cash=0 so the
    // multiplier doesn't matter), and the close date on 'deal' rows
    // (where the multiplier should apply).
    const day = String(r.day ?? "");
    a.bookings += num(r.bookings);
    a.cashCollected += cash;
    a.points += Math.floor((cash / 10) * multFor(day));
    a.showUps += num(r.show_ups);
    a.showRateEligible += num(r.show_rate_eligible);
    a.deals += num(r.deals);
  }

  const setters: SetterScore[] = SETTER_ROSTER.map((profile) => {
    const a = acc.get(profile.setter)!;
    return {
      profile,
      bookings: a.bookings,
      cashCollected: a.cashCollected,
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
    totalCash: setters.reduce((sum, s) => sum + s.cashCollected, 0),
    todayMultiplier: multFor(todayEt()),
  };
}
