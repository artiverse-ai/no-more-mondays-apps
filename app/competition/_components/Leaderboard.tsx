import type { CloserScore } from "../_lib/scoring";
import { CloserCard } from "./CloserCard";
import styles from "./competition.module.css";

/** Ranks after the podium. `podiumSize` is how many closers actually
 *  made the podium (those with basePoints > 0, capped at 3). The Field
 *  starts at rank podiumSize+1 and only shows up if anyone is left. */
export function Leaderboard({
  closers,
  podiumSize,
}: {
  closers: CloserScore[];
  podiumSize: number;
}) {
  const field = closers.slice(podiumSize);
  if (field.length === 0) return null;
  const startRank = podiumSize + 1;
  return (
    <section className={styles.leaderboard}>
      <div className={styles.leaderboardHeader}>
        <span>The Field</span>
        <span className={styles.leaderboardHeaderSub}>
          Ranks {startRank}+ · {field.length} closer{field.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className={styles.leaderboardList}>
        {field.map((c) => (
          <CloserCard key={c.profile.closerOwner} score={c} />
        ))}
      </div>
    </section>
  );
}
