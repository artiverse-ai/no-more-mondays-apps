import { fetchLeaderboard, type Period } from "./_lib/scoring";
import { TEAMS } from "./_data/roster";
import { Scoreboard } from "./_components/Scoreboard";
import { PeriodTabs } from "./_components/PeriodTabs";
import { CloserCard } from "./_components/CloserCard";
import { AutoRefresh } from "./_components/AutoRefresh";
import styles from "./_components/competition.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "NMM Closer Competition · Live" };

// IMPORTANT: closers see this dashboard. Render ONLY points + deal
// counts. Cash amounts never appear on /competition.

function parsePeriod(p: string | undefined): Period {
  // Default to "month" — closers + management want the season view first;
  // they can drill into "week" or "today" from the tabs.
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
      <div className={styles.headerBar}>
        <div className={styles.title}>
          <span className={styles.bolt}>⚡</span>
          NMM CLOSER <span className={styles.titleAccent}>BEAST MODE</span>
        </div>
        <AutoRefresh fetchedAt={board.fetchedAt} intervalSec={30} />
      </div>

      <PeriodTabs active={period} />

      <Scoreboard red={board.teams.red} blue={board.teams.blue} />

      <div className={styles.rosters}>
        <div className={styles.rosterColumn}>
          <div className={styles.rosterHeader} style={{ color: TEAMS.red.color }}>
            <span>{TEAMS.red.name}</span>
            <span style={{ fontSize: 10, color: "#94a3b8" }}>{board.teams.red.closers.length} closers</span>
          </div>
          {board.teams.red.closers.map((c) => (
            <CloserCard key={c.profile.closerOwner} score={c} />
          ))}
        </div>
        <div className={styles.rosterColumn}>
          <div className={styles.rosterHeader} style={{ color: TEAMS.blue.color }}>
            <span>{TEAMS.blue.name}</span>
            <span style={{ fontSize: 10, color: "#94a3b8" }}>{board.teams.blue.closers.length} closers</span>
          </div>
          {board.teams.blue.closers.map((c) => (
            <CloserCard key={c.profile.closerOwner} score={c} />
          ))}
        </div>
      </div>

      <section className={styles.activity}>
        <div className={styles.activityTitle}>Recent Deals · {board.allDealsCount} this {period}</div>
        {board.recentActivity.length === 0 ? (
          <div className={styles.empty}>No deals closed in this window yet. Get on the board.</div>
        ) : (
          board.recentActivity.map((d, i) => (
            <div key={i} className={styles.activityRow}>
              <span className={styles.activityDot} style={{ background: TEAMS[d.profile.team].color }} />
              <span className={styles.activityName}>#{d.profile.jersey} {d.profile.closerOwner}</span>
              <span style={{ color: "#94a3b8", fontSize: 12 }}>
                closed a {d.closeType === "FUC" ? "follow-up" : "deal"}
              </span>
              {d.closeType === "FUC" && <span className={styles.activityFuc}>FUC 2×</span>}
              <span style={{ color: "#64748b", fontSize: 11 }}>{d.dateClosed}</span>
              <span className={styles.activityPts}>+{d.points} pts</span>
            </div>
          ))
        )}
      </section>

      <div className={styles.rulesFooter}>
        <strong>Scoring:</strong> Every $10 closed = 1 pt &nbsp;·&nbsp;
        <strong>Follow-up closes count 2×</strong> &nbsp;·&nbsp;
        Team bonus unlocks at the threshold
        <br />
        <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500, letterSpacing: 0.5 }}>
          Live window: {board.windowStart} → {board.windowEnd}
        </span>
      </div>
    </main>
  );
}
