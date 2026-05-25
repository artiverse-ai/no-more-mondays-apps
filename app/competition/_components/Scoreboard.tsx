import type { TeamScore } from "../_lib/scoring";
import styles from "./competition.module.css";

const fmtInt = (n: number) => Math.round(n).toLocaleString();
const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

// IMPORTANT: closers see this dashboard. Show ONLY points + deal counts —
// never cash totals.
//
// Single-team layout — big "NO MORE MONDAYS" team total dominates, with
// a horizontal bonus-progress bar showing how close we are to unlocking
// the period bonus. Per Ben 2026-05-19: one team, threshold-based unlock.
// $ value of the bonus surfaced inline so closers know what they're
// playing for, not just the abstract point total.
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
            ? `🏆 TEAM BONUS UNLOCKED · ${fmtUsd(team.bonusUsd)}`
            : `${fmtInt(pointsToGo)} pts to ${fmtUsd(team.bonusUsd)} team bonus (${fmtInt(team.bonusThreshold)} pts)`}
        </div>
      </div>
    </section>
  );
}
