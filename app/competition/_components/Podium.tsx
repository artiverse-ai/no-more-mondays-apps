import type { CloserScore } from "../_lib/scoring";
import styles from "./competition.module.css";

const fmt = (n: number) => Math.round(n).toLocaleString();

const RANK_META: Array<{ medal: string; cls: keyof typeof styles }> = [
  { medal: "🥇", cls: "podiumGold" as const },
  { medal: "🥈", cls: "podiumSilver" as const },
  { medal: "🥉", cls: "podiumBronze" as const },
];

/** Top-3 podium that replaces the single MVP card. Gold #1 gets a
 *  crown wobble + glow pulse; silver/bronze get softer treatments.
 *  Each row staggers in on load. Hidden if nobody has scored yet. */
export function Podium({ closers }: { closers: CloserScore[] }) {
  const top3 = closers.slice(0, 3).filter((c) => c.basePoints > 0);
  if (top3.length === 0) return null;

  return (
    <section className={styles.podium}>
      <div className={styles.podiumHeader}>🏆 The Podium</div>
      <div className={styles.podiumRows}>
        {top3.map((c, i) => {
          const meta = RANK_META[i];
          const displayName = c.profile.displayName ?? c.profile.closerOwner;
          const initial = displayName.slice(0, 2).toUpperCase();
          return (
            <div
              key={c.profile.closerOwner}
              className={`${styles.podiumRow} ${styles[meta.cls]}`}
            >
              <span className={styles.podiumMedal} aria-hidden="true">{meta.medal}</span>
              <div className={styles.podiumAvatar}>
                {c.profile.imageUrl ? (
                  <img src={c.profile.imageUrl} alt={displayName} />
                ) : (
                  <span>{initial}</span>
                )}
                <span className={styles.podiumJersey}>{c.profile.jersey}</span>
              </div>
              <div className={styles.podiumInfo}>
                <div className={styles.podiumName}>{displayName}</div>
                <div className={styles.podiumSub}>
                  {c.deals} deal{c.deals !== 1 ? "s" : ""}
                  {c.fucDeals > 0 ? ` · ${c.fucDeals} FUC` : ""}
                </div>
              </div>
              <div className={styles.podiumPoints}>
                <div className={styles.podiumPointsVal}>{fmt(c.basePoints)}</div>
                <div className={styles.podiumPointsLbl}>PTS</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
