import type { CloserScore } from "../_lib/scoring";
import { CloserCard } from "./CloserCard";
import styles from "./competition.module.css";

/** Global ranking — all closers in one column, sorted by points DESC.
 *  Team affiliation shown via the team-color left border + jersey badge.
 *  This is the primary view; team scoreboard above is the "spice". */
export function Leaderboard({ closers }: { closers: CloserScore[] }) {
  return (
    <section className={styles.leaderboard}>
      <div className={styles.leaderboardHeader}>
        <span>Overall Ranking</span>
        <span className={styles.leaderboardHeaderSub}>{closers.length} closers</span>
      </div>
      <div className={styles.leaderboardList}>
        {closers.map((c) => (
          <CloserCard key={c.profile.closerOwner} score={c} />
        ))}
      </div>
    </section>
  );
}
