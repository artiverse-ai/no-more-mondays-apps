import type { CloserScore } from "../_lib/scoring";
import { TEAM } from "../_data/roster";
import styles from "./competition.module.css";

const fmtInt = (n: number) => Math.round(n).toLocaleString();

/** Hero callout celebrating the current #1 closer. Hidden if no one
 *  has scored yet (e.g., empty period). */
export function MvpHero({ mvp, periodLabel }: { mvp: CloserScore | null; periodLabel: string }) {
  if (!mvp || mvp.basePoints === 0) return null;
  const displayName = mvp.profile.displayName ?? mvp.profile.closerOwner;
  const initial = displayName.slice(0, 2).toUpperCase();
  // Suppress unused-import lint in case TEAM token is referenced later for accent color.
  void TEAM;

  return (
    <section className={styles.mvpHero}>
      <div className={styles.mvpCrown}>👑</div>
      <div className={styles.mvpAvatar}>
        {mvp.profile.imageUrl ? (
          <img src={mvp.profile.imageUrl} alt={displayName} />
        ) : (
          <span>{initial}</span>
        )}
        <span className={styles.mvpJersey}>{mvp.profile.jersey}</span>
      </div>
      <div className={styles.mvpInfo}>
        <div className={styles.mvpLabel}>{periodLabel} MVP</div>
        <div className={styles.mvpName}>{displayName}</div>
      </div>
      <div className={styles.mvpScore}>
        <div className={styles.mvpScoreVal}>{fmtInt(mvp.basePoints)}</div>
        <div className={styles.mvpScoreLbl}>POINTS</div>
      </div>
    </section>
  );
}
