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
  return p === "week" || p === "month" ? p : "today";
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

      <div style={{ maxWidth: 1280, margin: "24px auto 0", padding: "0 4px", fontSize: 11, color: "#94a3b8", textAlign: "center", letterSpacing: 0.5 }}>
        Every $10 closed = 1 pt · Follow-up closes count 2× · Team bonus unlocks at the threshold ·
        Live window: {board.windowStart} → {board.windowEnd}
      </div>
    </main>
  );
}
