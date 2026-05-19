import type { CloserScore } from "../_lib/scoring";
import { CloserCard } from "./CloserCard";
import styles from "./competition.module.css";

/** Ranks 4+ (top 3 live in the Podium above). If everyone fits in the
 *  podium (e.g., only 2 closers have points yet) this section hides. */
export function Leaderboard({ closers }: { closers: CloserScore[] }) {
  const field = closers.slice(3);
  if (field.length === 0) return null;
  return (
    <section className={styles.leaderboard}>
      <div className={styles.leaderboardHeader}>
        <span>The Field</span>
        <span className={styles.leaderboardHeaderSub}>Ranks 4+ · {field.length} closers</span>
      </div>
      <div className={styles.leaderboardList}>
        {field.map((c) => (
          <CloserCard key={c.profile.closerOwner} score={c} />
        ))}
      </div>
    </section>
  );
}
