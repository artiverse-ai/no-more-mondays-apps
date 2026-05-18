import type { CloserScore } from "../_lib/scoring";
import { TEAMS } from "../_data/roster";
import styles from "./competition.module.css";

const fmtInt = (n: number) => Math.round(n).toLocaleString();

/** Hero callout celebrating the current #1 closer. Hidden if no one
 *  has scored yet (e.g., empty period). */
export function MvpHero({ mvp, periodLabel }: { mvp: CloserScore | null; periodLabel: string }) {
  if (!mvp || mvp.basePoints === 0) return null;
  const teamColor = TEAMS[mvp.profile.team].color;
  const teamName = TEAMS[mvp.profile.team].name;
  const initial = mvp.profile.closerOwner.slice(0, 2).toUpperCase();

  return (
    <section className={styles.mvpHero}>
      <div className={styles.mvpCrown}>👑</div>
      <div className={styles.mvpAvatar} style={{ ["--team-color" as string]: teamColor }}>
        {mvp.profile.imageUrl ? <img src={mvp.profile.imageUrl} alt={mvp.profile.closerOwner} /> : <span>{initial}</span>}
        <span className={styles.mvpJersey}>{mvp.profile.jersey}</span>
      </div>
      <div className={styles.mvpInfo}>
        <div className={styles.mvpLabel}>{periodLabel} MVP</div>
        <div className={styles.mvpName}>{mvp.profile.closerOwner}</div>
        <div className={styles.mvpTeam} style={{ color: teamColor }}>{teamName}</div>
      </div>
      <div className={styles.mvpScore}>
        <div className={styles.mvpScoreVal}>{fmtInt(mvp.basePoints)}</div>
        <div className={styles.mvpScoreLbl}>POINTS</div>
      </div>
    </section>
  );
}
