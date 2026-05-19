**Audience:** Closers · Sales Leadership · Admins

The Closer Competition is a live scoreboard that ranks every active closer 1–N by points earned from closing deals. Teams (Red Hawks vs Blue Wolves) sit on top of the individual race for extra spice — every closer is racing themselves to #1, AND racing their team to the bonus threshold. The page updates every 30 seconds as deals close. Closers see this page, so cash amounts are hidden — only points, deal counts, ranks, and badges show.

**Live URL:** `https://no-more-mondays-apps.vercel.app/competition`

## 01 — How points are earned

> **Why:** A simple formula a closer can do in their head. Bigger deal = more points. Hustling a follow-up to close = double credit.

- **OCC (One-Call Close):** every $10 of cash collected = **1 point**. A $4,997 PIF earns 499 pts.
- **FUC (Follow-Up Close):** every $10 of cash collected = **2 points**. Same $4,997 deal closed on a follow-up earns 998 pts.
- The deal's OCC vs FUC classification comes from `int_calls_enriched.close_type` (set automatically by the dbt model based on whether you closed on the first booked call or a follow-up).
- A $0 deal (refund / partial cancel) earns 0 points — no penalty, no credit.

> 💡 **Why FUC counts double:** following up takes real work and retains a prospect who would otherwise leak out of the funnel. The 2× multiplier rewards persistence directly.

## 02 — Periods (Today / This Week / This Month)

> **Why:** Closers want different time horizons. Today = "how am I doing right now". Week = "am I on pace". Month = "am I winning the season". The page defaults to **This Month** because that's the season view.

- **Today** — single calendar day in ET. Bonus threshold 200 pts → +20 team bonus.
- **This Week** — current sales week, Sunday–Saturday ET. Bonus 1,000 pts → +100.
- **This Month** — current calendar month-to-date ET. Bonus 4,000 pts → +500.

A live countdown sits below the period tabs (`⏱ 12d 23h left in month`). Updates every second.

## 03 — Teams + jersey numbers

> **Why:** Individual ranking is the actual goal. Teams add team-vs-team competition on top so even closer #5 still has stakes in the day.

Two teams, balanced by historical L30D cash so neither starts with a talent edge:

| Team | Color | Jerseys |
|---|---|---|
| **Red Hawks** 🦅 | red | #10 Ben · #7 Tyler · #4 Morgan · #5 Cecilia |
| **Blue Wolves** 🐺 | blue | #11 Jordan · #21 Destiny · #8 Johanna · #9 Derek |

Jersey numbers are permanent — they don't shuffle between periods. They show as orange badges on every closer's avatar circle.

Reassigning teams or changing jersey numbers requires an engineering change to `app/competition/_data/roster.ts`. Ask the data team.

## 04 — Team bonus + progress bar

> **Why:** Forces collaboration. If your team is 100 pts away from the bonus and you have one more call today, that deal helps you AND tips the team over the line.

- The team scoreboard at the top shows a **progress bar** filling in team color: `850 pts to 1,000 bonus` while accumulating, `🏆 BONUS UNLOCKED · +100` once crossed.
- Bonus is **one-time per period** — once unlocked, the team can't earn it again by crossing higher thresholds within the same period.
- Bonus points get added to the team total displayed in the big number — so a team at 850 + 100 bonus shows as 950.

## 05 — Individual achievements (badges)

> **Why:** Beyond raw points, recognize specific patterns of excellence. Closers see chips on each other's cards and naturally chase the rare ones.

Four auto-detected achievements per period. Each shows as a gold chip below your deal count on your card; hover the chip to see the rule.

- **👑 MVP** — you're #1 on the overall leaderboard AND have at least 1 deal. Recalculated every refresh, so the crown can move during the day.
- **💎 FUC King** — you have the most FUC deals in the period. Ties **skip the award** (so it stays meaningful — if you and someone else tie, nobody gets it that period).
- **🎩 Hat Trick** — you closed 3+ deals on a single day during the period. Multiple closers can hold this.
- **🔥 Streak** — you closed at least one deal on 3+ consecutive days. Resets the moment you miss a day.

Badges scope to the **selected period** — your "Hat Trick" on the Month view means 3+ deals in a single day this month; on the Week view it has to be within Sun–Sat.

## 06 — Reading the leaderboard

> **Why:** A closer should know exactly where they stand in 3 seconds.

- Cards sort by points DESC across both teams (single column, not split by team).
- **🥇 🥈 🥉** medals on rank 1 / 2 / 3. Capsule `#N` badge for rank 4 onward.
- Left border of each card is the team color → tells you who's on which team at a glance.
- The current overall #1 also gets a **🏆 MVP hero pill** above the leaderboard with a floating crown.

## 07 — Recent Deals feed

> **Why:** The social heartbeat of the page — closers feel the live action and see when teammates score.

The bottom section shows the most recent 10 deals across both teams, newest first:

- Team-color dot + jersey + closer name
- "closed a deal" / "closed a follow-up"
- Gold **FUC 2×** chip if it was a follow-up
- Relative timestamp ("today", "yesterday", "3 days ago") — updates client-side every 30 seconds
- Points earned in big gold on the right (`+599 pts`)

## 08 — What's hidden + why

> **Why:** Closers shouldn't compare each other's earnings or see the full financial pipeline. Points + counts are enough for competition. Cash stays in leadership-only dashboards.

Never appears on `/competition`:

- Dollar amounts (no AOV, no cash collected per deal, no team revenue)
- Conversion rates (show rate, close rate, attendance rate)
- Forecast targets
- Per-closer historical trends across periods

If you need any of that, those numbers live on `/dashboards/weekly-report/[slug]` (leadership-only).

## 09 — Who appears on the board

> **Why:** Only people actively closing should be ranked. Retired closers shouldn't haunt the standings.

- The roster is filtered every refresh against `nmm_calendar.closers` where `is_active = true`.
- To take someone off the leaderboard: flip their `is_active` to `false` in that table → they disappear within 30 seconds. No deploy needed.
- To add someone: they need a row in `closers` with `is_active = true` AND a row in the engineering-side roster file (`app/competition/_data/roster.ts`) with a team + jersey number. Both required.

Today's active roster: Ben, Tyler, Morgan, Cecilia (Red) · Jordan, Destiny, Johanna, Derek (Blue). Luke is `is_active=false`; Grace isn't in the `closers` table — both excluded.

## 10 — FAQ

> **Why:** Common closer questions, in one place.

- **My deal closed but it's not showing.** Check that `is_deal = TRUE` on the row in `int_calls_enriched` and that your name is in the `closers` table with `is_active=true`. There's also a ~few-hours delay before the dbt model refreshes — fresh deals can take up to that long to appear.
- **Why are my points different on Today vs Week vs Month?** Different windows count different deals. A deal closed last Tuesday doesn't show in Today, does show in Week (if Tuesday was Sun–Sat) and Month.
- **What happens if two closers tie on points?** Tied closers list alphabetically. We can change this if it bothers anyone — ask leadership.
- **My jersey image is just my initials. When do I get a real portrait?** When leadership ships AI-generated portraits. Until then everyone has clean initial-circles in their team color.
- **Can someone outside NMM see this page?** Currently yes — there's no auth wall on `/competition`. If leadership wants it locked to nomoremondays.io emails, that's a 5-minute add — ask the data team.

## 11 — Where the rules live (engineers)

> **Why:** Every rule above is one file edit. No DB schema changes needed for normal tweaks.

- `app/competition/_data/roster.ts` — teams, jersey numbers, bonus thresholds, team colors, team names
- `app/competition/_lib/scoring.ts` — point formula, period boundaries, achievement detection
- Source data: `dbt_tuddin.int_calls_enriched` (deals) + `nmm_calendar.closers` (active roster)
