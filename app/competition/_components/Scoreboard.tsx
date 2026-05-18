import type { TeamScore } from "../_lib/scoring";
import styles from "./competition.module.css";

const fmtInt = (n: number) => Math.round(n).toLocaleString();

// IMPORTANT: closers see this dashboard. Show ONLY points + deal counts —
// never cash totals. Cash stays on internal-only weekly reports.
export function Scoreboard({ red, blue }: { red: TeamScore; blue: TeamScore }) {
  return (
    <section className={styles.scoreboard}>
      <TeamPanel team={red} align="left" />
      <div className={styles.vs}>VS</div>
      <TeamPanel team={blue} align="right" />
    </section>
  );
}

function TeamPanel({ team, align }: { team: TeamScore; align: "left" | "right" }) {
  const rightClass = align === "right" ? styles.teamScoreRight : "";
  const pctToBonus = Math.min(100, Math.round((team.basePoints / team.bonusThreshold) * 100));
  const pointsToGo = Math.max(0, team.bonusThreshold - team.basePoints);
  return (
    <div className={`${styles.teamScore} ${rightClass}`}>
      <div className={styles.teamName} style={{ color: team.color }}>{team.name}</div>
      <div className={styles.teamPoints} style={{ color: team.color }}>{fmtInt(team.totalPoints)}</div>
      <div className={styles.teamMeta}>
        {fmtInt(team.basePoints)} base
        {team.bonusEarned && ` · +${fmtInt(team.bonusPoints)} bonus`}
        {" · "}
        {fmtInt(team.totalDeals)} {team.totalDeals === 1 ? "deal" : "deals"}
      </div>
      {/* Bonus progress bar — fills with team color, label depends on state */}
      <div className={styles.bonusBar} aria-label="Progress to team bonus">
        <div
          className={styles.bonusBarFill}
          style={{ width: `${pctToBonus}%`, background: team.color }}
        />
        <div className={styles.bonusBarLabel}>
          {team.bonusEarned
            ? `🏆 BONUS UNLOCKED · +${fmtInt(team.bonusPoints)}`
            : `${fmtInt(pointsToGo)} pts to ${fmtInt(team.bonusThreshold)} bonus`}
        </div>
      </div>
    </div>
  );
}
