import { fetchLeaderboard, type Period } from "./_lib/scoring";
import { TEAM } from "./_data/roster";
import { Scoreboard } from "./_components/Scoreboard";
import { PeriodTabs } from "./_components/PeriodTabs";
import { Leaderboard } from "./_components/Leaderboard";
import { Podium } from "./_components/Podium";
import { Countdown } from "./_components/Countdown";
import { RelativeTime } from "./_components/RelativeTime";
import { HeroStrip } from "./_components/HeroStrip";
import { SplashIntro } from "./_components/SplashIntro";
import styles from "./_components/competition.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "The No More Mondays Games · Live" };

// IMPORTANT: closers see this dashboard. Render ONLY points + deal
// counts. Cash amounts never appear on /competition.
//
// Single team layout per Ben 2026-05-19 — everyone races individually
// for rank, contributes to one team pot, bonus unlocks when team
// crosses the period threshold. No Red/Blue split.

function parsePeriod(p: string | undefined): Period {
  return p === "today" || p === "week" ? p : "month";
}

export default async function CompetitionPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const period = parsePeriod(params.period);
  const board = await fetchLeaderboard(period);

  return (
    <main className={styles.shell}>
      <SplashIntro />

      <div className={styles.topBar}>
        <div className={styles.heroMotivation} aria-hidden="true">
          <span className={styles.heroMotivationDot} />
          EVERY CALL COUNTS
        </div>
      </div>

      <div className={styles.heroRow}>
        <HeroStrip />
        <div className={styles.heroContentCol}>
          <PeriodTabs active={period} />
          <div className={styles.countdownRow}>
            <Countdown period={period} />
          </div>
          <Scoreboard team={board.team} />
          <Podium closers={board.closers} />
        </div>
      </div>

      <Leaderboard closers={board.closers} />

      <section className={styles.activity}>
        <div className={styles.activityTitle}>🔥 Recent Deals · {board.allDealsCount} this {period}</div>
        {board.recentActivity.length === 0 ? (
          <div className={styles.empty}>No deals closed in this window yet. Get on the board.</div>
        ) : (
          board.recentActivity.map((d, i) => (
            <div key={i} className={styles.activityRow}>
              <span className={styles.activityDot} />
              <span className={styles.activityName}>#{d.profile.jersey} {d.profile.closerOwner}</span>
              <span className={styles.activityMeta}>
                closed a {d.closeType === "FUC" ? "follow-up" : "deal"}
              </span>
              {d.closeType === "FUC" && <span className={styles.activityFuc}>FUC 2×</span>}
              <span className={styles.activityDate}>
                <RelativeTime dateIso={d.dateClosed} fallback={d.dateClosed} />
              </span>
              <span className={styles.activityPts}>+{d.points} pts</span>
            </div>
          ))
        )}
      </section>

      <div className={styles.rulesFooter}>
        <strong>Scoring:</strong> Every $10 closed = 1 pt &nbsp;·&nbsp;
        <strong>Follow-up closes count 2×</strong> &nbsp;·&nbsp;
        Team bonus unlocks at {board.team.bonusThreshold.toLocaleString()} pts ({period})
        <br />
        <span className={styles.rulesFooterSub}>
          Window: {board.windowStart} → {board.windowEnd} · Team: {TEAM.name}
        </span>
      </div>
    </main>
  );
}
