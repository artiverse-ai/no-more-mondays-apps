import type { TeamScore } from "../_lib/scoring";
import styles from "./competition.module.css";

const fmtInt = (n: number) => Math.round(n).toLocaleString();

// IMPORTANT: closers see this dashboard. Show ONLY points + deal counts —
// never cash totals.
//
// Single-team layout — big "NO MORE MONDAYS" team total dominates, with
// a horizontal bonus-progress bar showing how close we are to unlocking
// the period bonus. Per Ben 2026-05-19: one team, threshold-based unlock.
export function Scoreboard({ team }: { team: TeamScore }) {
  const pctToBonus = Math.min(100, Math.round((team.basePoints / team.bonusThreshold) * 100));
  const pointsToGo = Math.max(0, team.bonusThreshold - team.basePoints);

  return (
    <section className={styles.scoreboard}>
      <div className={styles.teamLabel}>
        <span className={styles.teamLabelMain}>{team.name}</span>
        <span className={styles.teamLabelSub}>{fmtInt(team.totalDeals)} {team.totalDeals === 1 ? "deal" : "deals"} this period</span>
      </div>
      <div className={styles.teamPoints}>{fmtInt(team.totalPoints)}</div>
      <div className={styles.teamPointsLabel}>
        {fmtInt(team.basePoints)} base{team.bonusEarned && ` · +${fmtInt(team.bonusPoints)} bonus 🏆`}
      </div>

      <div className={styles.bonusBar} aria-label="Progress to team bonus">
        <div className={styles.bonusBarFill} style={{ width: `${pctToBonus}%` }} />
        <div className={styles.bonusBarLabel}>
          {team.bonusEarned
            ? `🏆 BONUS UNLOCKED · +${fmtInt(team.bonusPoints)}`
            : `${fmtInt(pointsToGo)} pts to ${fmtInt(team.bonusThreshold)} bonus`}
        </div>
      </div>
    </section>
  );
}
