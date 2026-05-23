import { fetchSetterLeaderboard } from "../_lib/setter-scoring";
import type { Period } from "../_lib/scoring";
import { PeriodTabs } from "../_components/PeriodTabs";
import { Countdown } from "../_components/Countdown";
import { HeroStrip } from "../_components/HeroStrip";
import { SplashIntro } from "../_components/SplashIntro";
import { ViewToggle } from "../_components/ViewToggle";
import { SetterStandings } from "../_components/SetterStandings";
import { MultiplierBanner } from "../_components/MultiplierBanner";
import { MultiplierSheetLink } from "../_components/MultiplierSheetLink";
import styles from "../_components/competition.module.css";

// 30s cache so tab clicks feel instant — same as the closer page.
export const revalidate = 30;

export const metadata = { title: "The No More Mondays Games · Setters" };

// Setter view of the competition. Same shell, poster and theming as
// /competition — just a simple 3-setter ranked board (no team pot, no
// podium/field split). Setters score 100 pts per booked call.

function parsePeriod(p: string | undefined): Period {
  return p === "today" || p === "week" ? p : "month";
}

export default async function SetterCompetitionPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const period = parsePeriod(params.period);
  const board = await fetchSetterLeaderboard(period);

  return (
    <main className={styles.shell}>
      <SplashIntro />

      <div className={styles.topBar}>
        <ViewToggle active="setter" period={period} />
        <div className={styles.heroMotivation} aria-hidden="true">
          <span className={styles.heroMotivationDot} />
          EVERY CALL COUNTS
        </div>
      </div>

      <MultiplierSheetLink />
      <MultiplierBanner multiplier={board.todayMultiplier} />

      {/* key={period} remounts the board on period change so the
          avatar flip animations re-run — matches the closer page. */}
      <div key={period}>
        <div className={styles.heroRow}>
          <HeroStrip />
          <div className={styles.heroContentCol}>
            <PeriodTabs active={period} basePath="/competition/setter" />
            <div className={styles.countdownRow}>
              <Countdown period={period} />
            </div>
            <SetterStandings setters={board.setters} />
          </div>
        </div>
      </div>

      <div className={styles.rulesFooter}>
        <strong>Setter scoring:</strong> every $10 of cash collected from
        your booked calls = 1 pt &nbsp;·&nbsp; multiplier (if any) applies
        on the day you booked &nbsp;·&nbsp; show &amp; close rates are on
        the calls you own
        <br />
        <span className={styles.rulesFooterSub}>
          Window: {board.windowStart} → {board.windowEnd} · Setters compete
          individually
        </span>
      </div>
    </main>
  );
}
