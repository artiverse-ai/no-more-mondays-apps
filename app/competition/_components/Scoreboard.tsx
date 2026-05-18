import type { TeamScore } from "../_lib/scoring";
import styles from "./competition.module.css";

const fmtInt = (n: number) => Math.round(n).toLocaleString();
const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

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
  return (
    <div className={`${styles.teamScore} ${rightClass}`}>
      <div className={styles.teamName} style={{ color: team.color }}>{team.name}</div>
      <div className={styles.teamPoints} style={{ color: team.color }}>{fmtInt(team.totalPoints)}</div>
      <div className={styles.teamMeta}>
        {fmtInt(team.basePoints)} base
        {team.bonusEarned && ` · +${fmtInt(team.bonusPoints)} bonus`}
        {" · "}
        {fmtInt(team.totalDeals)} deals · {fmtUsd(team.totalCash)}
      </div>
      {team.bonusEarned ? (
        <span className={styles.bonusBadge}>🏆 Bonus unlocked</span>
      ) : (
        <span className={styles.teamMeta} style={{ marginTop: 4 }}>
          {fmtInt(team.bonusThreshold - team.basePoints)} to bonus
        </span>
      )}
    </div>
  );
}
