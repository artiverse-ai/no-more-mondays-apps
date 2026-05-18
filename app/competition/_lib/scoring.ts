// Competition scoring engine — pulls deals from int_calls_enriched and
// converts them to points per the user's spec:
//   • $10 cash collected = 1 point (OCC = One-Call Close)
//   • $10 cash collected = 2 points (FUC = Follow-Up Close — "harder" deal,
//     closer had to retain the prospect through a follow-up)
// Plus per-team bonus when daily/weekly/monthly total crosses a threshold
// (configured in roster.ts → BONUS_THRESHOLDS).

import { bq } from "@/lib/bq";
import {
  ROSTER,
  ROSTER_BY_NAME,
  TEAMS,
  BONUS_THRESHOLDS,
  type CloserProfile,
  type Team,
} from "../_data/roster";

const ENRICHED = "`no-more-mondays-analytics.dbt_tuddin.int_calls_enriched`";
const EMAIL_EXCLUSION =
  "prospect_email_lc NOT LIKE '%@nomoremondays.io%' " +
  "AND prospect_email_lc NOT IN ('jaromir1998@gmail.com','marek@sintano.com')";

export type Period = "today" | "week" | "month";

export type Deal = {
  closerOwner: string;
  cashCollected: number;
  closeType: "OCC" | "FUC" | "UNKNOWN";
  dateClosed: string;            // YYYY-MM-DD
  prospectEmail: string;
};

export type CloserScore = {
  profile: CloserProfile;
  basePoints: number;
  occPoints: number;
  fucPoints: number;
  deals: number;
  fucDeals: number;
  cashCollected: number;
  recentDeals: Deal[];          // last 5 for the activity feed
};

export type TeamScore = {
  team: Team;
  name: string;
  short: string;
  color: string;
  basePoints: number;
  bonusPoints: number;
  totalPoints: number;
  bonusEarned: boolean;
  bonusThreshold: number;
  closers: CloserScore[];        // sorted by basePoints DESC
  totalDeals: number;
  totalCash: number;
};

export type Leaderboard = {
  period: Period;
  windowStart: string;
  windowEnd: string;
  fetchedAt: string;
  teams: { red: TeamScore; blue: TeamScore };
  allDealsCount: number;
  /** Recent activity feed across both teams, newest first, max 10. */
  recentActivity: Array<Deal & { profile: CloserProfile; points: number }>;
};

/** Convert a period string + "now" timestamp to a [start, end] DATE window
 *  in ET-bucketed YYYY-MM-DD form. Today = single day; week = current
 *  Sun-Sat ET (sales week); month = current month-to-date. */
export function periodWindow(period: Period, now: Date = new Date()): { start: string; end: string } {
  // Use UTC dates throughout — the BQ DATE columns are ET-bucketed upstream
  // so a UTC-derived "today" works correctly enough for v1. Sub-millisecond
  // edge cases at midnight ET are acceptable for the competition feed.
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  if (period === "today") {
    return { start: iso(today), end: iso(today) };
  }
  if (period === "week") {
    // Sales week = Sun-Sat. dow: 0=Sun..6=Sat
    const dow = today.getUTCDay();
    const sun = new Date(today);
    sun.setUTCDate(today.getUTCDate() - dow);
    const sat = new Date(sun);
    sat.setUTCDate(sun.getUTCDate() + 6);
    return { start: iso(sun), end: iso(sat) };
  }
  // month
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
  return { start: iso(monthStart), end: iso(monthEnd) };
}

/** Points = cash / 10, doubled for FUC. */
export function pointsForDeal(cashCollected: number, closeType: "OCC" | "FUC" | "UNKNOWN"): number {
  const base = cashCollected / 10;
  const multiplier = closeType === "FUC" ? 2 : 1;
  return Math.floor(base * multiplier);
}

/** Fetch raw deals for the window, then aggregate into TeamScore[] and an
 *  activity feed. Returns a fully-rendered Leaderboard. */
export async function fetchLeaderboard(period: Period, now: Date = new Date()): Promise<Leaderboard> {
  const { start, end } = periodWindow(period, now);
  const [rows] = await bq().query({
    query: `
      SELECT
        closer_owner                                AS closer_owner,
        IFNULL(cash_collected, 0)                   AS cash_collected,
        IFNULL(close_type, 'UNKNOWN')               AS close_type,
        FORMAT_DATE('%F', date_closed)              AS date_closed,
        prospect_email_lc                           AS prospect_email
      FROM ${ENRICHED}
      WHERE is_deal
        AND date_closed BETWEEN DATE(@start) AND DATE(@end)
        AND closer_owner IS NOT NULL
        AND ${EMAIL_EXCLUSION}
      ORDER BY date_closed DESC, cash_collected DESC
    `,
    params: { start, end },
    types: { start: "STRING", end: "STRING" },
  });

  const deals: Deal[] = (rows as Array<Record<string, unknown>>).map((r) => ({
    closerOwner: String(r.closer_owner ?? ""),
    cashCollected: Number(r.cash_collected ?? 0),
    closeType: (r.close_type === "OCC" || r.close_type === "FUC" ? r.close_type : "UNKNOWN") as Deal["closeType"],
    dateClosed: String(r.date_closed ?? ""),
    prospectEmail: String(r.prospect_email ?? ""),
  }));

  // Bucket deals per closer (skip closers not on the roster)
  const perCloser = new Map<string, CloserScore>();
  for (const profile of ROSTER) {
    perCloser.set(profile.closerOwner, {
      profile,
      basePoints: 0,
      occPoints: 0,
      fucPoints: 0,
      deals: 0,
      fucDeals: 0,
      cashCollected: 0,
      recentDeals: [],
    });
  }

  for (const deal of deals) {
    const closer = perCloser.get(deal.closerOwner);
    if (!closer) continue;  // closer not rostered — skip silently
    const pts = pointsForDeal(deal.cashCollected, deal.closeType);
    closer.basePoints += pts;
    closer.cashCollected += deal.cashCollected;
    closer.deals += 1;
    if (deal.closeType === "FUC") {
      closer.fucPoints += pts;
      closer.fucDeals += 1;
    } else {
      closer.occPoints += pts;
    }
    if (closer.recentDeals.length < 5) {
      closer.recentDeals.push(deal);
    }
  }

  // Group closers into teams
  const redClosers: CloserScore[] = [];
  const blueClosers: CloserScore[] = [];
  for (const score of perCloser.values()) {
    (score.profile.team === "red" ? redClosers : blueClosers).push(score);
  }
  redClosers.sort((a, b) => b.basePoints - a.basePoints);
  blueClosers.sort((a, b) => b.basePoints - a.basePoints);

  const buildTeam = (team: Team, closers: CloserScore[]): TeamScore => {
    const basePoints = closers.reduce((s, c) => s + c.basePoints, 0);
    const meta = TEAMS[team];
    const threshold = BONUS_THRESHOLDS[period].threshold;
    const bonusValue = BONUS_THRESHOLDS[period].bonus;
    const bonusEarned = basePoints >= threshold;
    return {
      team,
      name: meta.name,
      short: meta.short,
      color: meta.color,
      basePoints,
      bonusPoints: bonusEarned ? bonusValue : 0,
      totalPoints: basePoints + (bonusEarned ? bonusValue : 0),
      bonusEarned,
      bonusThreshold: threshold,
      closers,
      totalDeals: closers.reduce((s, c) => s + c.deals, 0),
      totalCash: closers.reduce((s, c) => s + c.cashCollected, 0),
    };
  };

  // Recent activity feed (newest 10 deals across both teams)
  const recentActivity = deals
    .map((d) => {
      const profile = ROSTER_BY_NAME.get(d.closerOwner);
      if (!profile) return null;
      return { ...d, profile, points: pointsForDeal(d.cashCollected, d.closeType) };
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .slice(0, 10);

  return {
    period,
    windowStart: start,
    windowEnd: end,
    fetchedAt: new Date().toISOString(),
    teams: { red: buildTeam("red", redClosers), blue: buildTeam("blue", blueClosers) },
    allDealsCount: deals.length,
    recentActivity,
  };
}
