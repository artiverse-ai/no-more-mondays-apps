**Audience:** Closers · Setters · Sales Leadership · Admins

The NMM Closer Competition is a live, public scoreboard that ranks every active closer 1-N by points earned from closing deals. Teams (Red Hawks vs Blue Wolves) layer team competition on top of the individual race. Updates every 30 seconds as deals close. Closers see this dashboard — cash amounts are intentionally hidden, only points + deal counts appear.

**Live URL:** `https://no-more-mondays-apps.vercel.app/competition`

## 01 — How points work

> **Why:** A simple, fair formula every closer can do in their head. Bigger deal = more points. Hustling a follow-up to close = double credit.

**The two rules:**

| Deal type | Formula | Example |
|---|---|---|
| **OCC** (One-Call Close — closed on first call) | `$10 cash collected = 1 point` | $4,997 deal → 499 pts |
| **FUC** (Follow-Up Close — closed on a follow-up call after the first call didn't close) | `$10 cash collected = 2 points` | $4,997 deal → 998 pts (2×) |

**Why FUC counts double:** Following up takes more effort, retains a prospect who would otherwise have leaked out of the funnel, and proves the closer's persistence. The 2× multiplier rewards that work directly.

Source of "OCC vs FUC" classification: `int_calls_enriched.close_type` (populated by the dbt model based on whether the deal closed on the first booked call or a follow-up call).

**Cash → points formula in code:**

```
basePoints = Math.floor(cash_collected / 10) × (closeType === "FUC" ? 2 : 1)
```

Points are floored (integer only). $4,997 OCC = 499 pts. $4,999 OCC = 499 pts (the extra $2 doesn't get a point until you hit the next $10).

## 02 — Periods (Today / This Week / This Month)

> **Why:** Closers + leadership want different time horizons. Today = "how am I doing right now". Week = "am I on pace". Month = "am I winning the season".

| Period | Window | Bonus threshold | Bonus value |
|---|---|---|---|
| **Today** | Single day in ET | 200 base pts | +20 team pts |
| **This Week** | Sales week Sun-Sat ET (current) | 1,000 base pts | +100 team pts |
| **This Month** | Calendar month-to-date ET | 4,000 base pts | +500 team pts |

The page **defaults to This Month** when you load `/competition` — that's the "season view". Click the tabs to drill into Today or This Week.

A live **countdown timer** below the tabs shows time remaining in the selected period: `⏱ 12d 23h left in month`. Updates every second.

## 03 — Teams

> **Why:** Individual ranking is the primary goal. Teams add extra spice — even if you're #6 individually, you can still help your team win the bonus.

Two teams, balanced by historical L30D cash so neither side starts with a massive talent advantage:

| Team | Color | Jersey numbers |
|---|---|---|
| **Red Hawks** 🦅 | Red `#dc2626` | #10 Ben · #7 Tyler · #4 Morgan · #5 Cecilia |
| **Blue Wolves** 🐺 | Blue `#0099ff` | #11 Jordan · #21 Destiny · #8 Johanna · #9 Derek |

Each closer has a permanent **jersey number** (orange badge on the avatar circle). Jersey numbers are fixed — they don't change between periods.

**Reassigning teams or changing jersey numbers** requires editing `app/competition/_data/roster.ts` and shipping. Not a closer-facing change.

## 04 — Team bonus

> **Why:** Forces collaboration. If your team is 100 pts away from the bonus and you have one more call today, that one deal matters double — to you AND to the team total.

When a team's **base points** for the period cross the threshold (see §02), the team earns **bonus points** that get added to their total. The scoreboard shows a **progress bar** filling with the team color so closers always know how close to bonus they are.

States:
- **Bar partially filled:** `850 pts to 1000 bonus` — keep pushing
- **Bar full + "🏆 BONUS UNLOCKED · +100":** earned, locked in for the period

A team can only earn the bonus once per period (you can't double-dip by crossing 200 today, then again at 400, etc. — it's a one-time unlock per period).

## 05 — Individual achievements (badges on cards)

> **Why:** Beyond pure points, recognize specific patterns of excellence. Closers see chips on each other's cards and naturally compete for the rare ones.

Four achievements, auto-detected from the deal data for the current period:

| Badge | Icon | Rule | How to earn |
|---|---|---|---|
| **MVP** | 👑 | Top of the overall leaderboard with at least 1 deal | Be #1 across both teams. Recalculated every refresh. |
| **FUC King** | 💎 | Most FUC deals in the period — ties skip the award | Close more follow-ups than anyone else. If you and someone else tie at the top, **nobody** gets it (keeps the badge meaningful). |
| **Hat Trick** | 🎩 | 3+ deals closed in a single day | Have any single day with 3+ closes. Multiple closers can hold this. |
| **Streak** | 🔥 | 3+ consecutive days with at least one deal | String together 3+ days with deals back-to-back. Resets when you miss a day. |

Badges show as gold/orange chips below the deal count on each closer card. Hover to see the rule.

**Period-scoped:** Achievements reset when you switch periods. "Hat Trick" on the Month view means 3+ deals in a single day during this month; on the Week view, it has to fall within this Sun-Sat.

## 06 — Ranking visualization

> **Why:** A closer should know exactly where they stand in 3 seconds.

Each closer card carries a **rank badge** on the left:
- 🥇 (gold medal) — rank #1
- 🥈 (silver medal) — rank #2
- 🥉 (bronze medal) — rank #3
- **#4, #5, #6…** — capsule badge for everyone else, navy on cream

Cards are sorted by base points DESC across both teams. Team affiliation shown via the team-color left border + the jersey number badge color.

The current #1 also appears in a **🏆 MVP hero pill** above the leaderboard with their jersey, name, team, and points.

## 07 — Live updates

The dashboard re-fetches data every **30 seconds** automatically — no refresh needed. The pulsing red "🔴 LIVE · 12s" badge in the top-right shows when data was last fetched.

Behind the scenes:
- Server component fetches from BigQuery
- Client-side `AutoRefresh` calls `router.refresh()` every 30s
- BigQuery returns the latest data
- Page re-renders seamlessly

There's no manual refresh button — the page is always within 30 seconds of current.

## 08 — Active roster filter

> **Why:** Only people actively closing should be on the leaderboard. Retired closers shouldn't haunt the rankings forever.

The roster is filtered every refresh against `nmm_calendar.closers` where `is_active = true`. To take someone off the leaderboard:
- Flip their row to `is_active = false` in the closers table
- Next refresh (≤30s), they disappear

To add someone:
- They need a row in `nmm_calendar.closers` with `is_active = true`
- AND a row in `app/competition/_data/roster.ts` with their team + jersey number
- Both required — the BQ table controls eligibility, the roster file controls display

Today's active roster: 8 closers (Ben, Tyler, Morgan, Cecilia, Jordan, Destiny, Johanna, Derek). Luke is inactive (excluded). Grace isn't in the closers table (excluded).

## 09 — Activity feed

The "🔥 Recent Deals" section at the bottom shows the most recent 10 deals across both teams in chronological order (newest first). Each row:

- Team-color dot (red or blue)
- Jersey number + closer name
- "closed a deal" or "closed a follow-up"
- **FUC 2× chip** (gold) if it was a follow-up
- Relative time ("today", "yesterday", "3 days ago") — updates client-side every 30s
- **+N pts** in big gold (the points that deal earned)

This is the social feed — closers can see when teammates closed and feel the live action.

## 10 — What you DON'T see

> **Why:** Closers shouldn't be comparing each other's earnings or seeing the entire pipeline financials. Points + counts are enough for competition. Cash stays in internal-only dashboards.

Hidden from `/competition`:
- 💵 Any dollar amount (no AOV, no cash collected per deal, no team revenue total)
- 🎯 Conversion rates (show rate, close rate, etc.)
- 📅 Forecast targets (only on the internal weekly report dashboards)
- 📊 Per-closer historical trends (compete on this period, not on lifetime)

Internal dashboards at `/dashboards/weekly-report/[slug]` still show everything financial for leadership eyes.

## 11 — Refresh rules / edge cases

| Situation | Behavior |
|---|---|
| Closer has 0 deals in the period | Still appears on the leaderboard at the bottom with 0 pts and "0 deals". Empty cards keep visible so they know to get started. |
| Two closers tied on points | Tie-break is alphabetical by `closer_owner`. We could change this — flag if it bothers anyone. |
| Deal closed across midnight ET | Counted in the day the `date_closed` BQ column says. dbt classifies in ET. |
| Cash collected updated after a deal initially booked (payment-plan top-up) | Recalculated on every refresh. If a $1,000 deposit turns into $4,997 PIF a week later, points retroactively bump. |
| Closer leaves NMM mid-period | When marked `is_active=false`, they disappear from the board. Their deals are no longer counted in team totals. |
| Bonus thresholds set wrong | Edit `BONUS_THRESHOLDS` in `app/competition/_data/roster.ts` — applies on next refresh. |
| New deal type added (e.g. "PIF", "Partial") that isn't OCC or FUC | Defaults to OCC scoring (1× multiplier). Adjust `pointsForDeal()` in `_lib/scoring.ts`. |

## 12 — How to change the rules

All competition logic lives in **two files** so it's easy to audit:

- **`app/competition/_data/roster.ts`** — teams, jersey numbers, bonus thresholds, team colors, team names
- **`app/competition/_lib/scoring.ts`** — point formula, period boundaries, achievement detection

Each constant in those files has a comment explaining the rule. Ship a small PR to change anything. No BQ schema changes needed for rule tweaks.

## 13 — FAQ

**Q: My deal closed but it's not showing — what's wrong?**
A: Check `int_calls_enriched` in BigQuery — that's the source. If `is_deal = TRUE` for your deal but you don't see points, it might be the freshness lag (dbt model refreshes every few hours). If your name doesn't appear at all, check that you're in the `closers` table with `is_active = true`.

**Q: I closed a $0 deal (refund, partial). Do I lose points?**
A: No — points are based on `cash_collected`. A $0 deal contributes 0 points, neither adds nor removes from your total.

**Q: Can I see last month's standings?**
A: Not in v1 — only current periods. If leadership wants historical archives ("April champions"), we can add a `/competition/archive/[period]` route. Ask.

**Q: Why are my points different between Today, Week, and Month?**
A: The window changes what deals get counted. A deal from May 5 doesn't count in Today (May 19), counts in Month (May 5 is in May), might count in Week depending on which Sun-Sat the deal fell into.

**Q: My jersey image is just my initials. When will I have a real portrait?**
A: Custom AI-generated portraits will be added when leadership provides them. Drop the image into `/public/competition/jerseys/<name>.png` and the card auto-swaps. Until then everyone has clean initial-circles in their team color.

**Q: Can someone outside the company see this?**
A: Currently yes — `/competition` is publicly viewable. There's no auth wall. If you want it locked to NMM domain emails only, that's a 5-minute addition — let leadership decide.

## 14 — For engineers — source files

| Concern | File |
|---|---|
| Teams, jerseys, bonus thresholds | `app/competition/_data/roster.ts` |
| Scoring formula, period windows, achievement detection, BQ queries | `app/competition/_lib/scoring.ts` |
| Page layout, MVP hero, leaderboard, activity feed | `app/competition/page.tsx` |
| Closer card render (rank badge + jersey avatar + achievements) | `app/competition/_components/CloserCard.tsx` |
| Team scoreboard (Red vs Blue + bonus progress bars) | `app/competition/_components/Scoreboard.tsx` |
| MVP hero pill | `app/competition/_components/MvpHero.tsx` |
| Period tabs (Today/Week/Month) | `app/competition/_components/PeriodTabs.tsx` |
| Live countdown timer | `app/competition/_components/Countdown.tsx` |
| Relative timestamps in activity feed | `app/competition/_components/RelativeTime.tsx` |
| Auto-refresh every 30s | `app/competition/_components/AutoRefresh.tsx` |
| All Beast Games × NMM theme styling | `app/competition/_components/competition.module.css` |

Source-of-truth BQ tables:
- `dbt_tuddin.int_calls_enriched` — deals, `closer_owner`, `cash_collected`, `close_type`, `date_closed`
- `nmm_calendar.closers` — active roster (`email`, `is_active`)
