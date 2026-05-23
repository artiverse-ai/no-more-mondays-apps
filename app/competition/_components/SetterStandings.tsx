import type { SetterScore } from "../_lib/setter-scoring";
import styles from "./competition.module.css";

const fmtInt = (n: number) => Math.round(n).toLocaleString();
const fmtPct = (f: number | null) =>
  f == null ? "—" : `${Math.round(f * 100)}%`;

// Reuses the closer Podium styling so the setter view feels identical —
// there are only 3 setters, so this simple ranked list IS the board
// (no separate podium / field split).
const RANK_META = [
  { medal: "🥇", cls: "podiumGold" as const },
  { medal: "🥈", cls: "podiumSilver" as const },
  { medal: "🥉", cls: "podiumBronze" as const },
];

export function SetterStandings({ setters }: { setters: SetterScore[] }) {
  return (
    <section className={styles.podium}>
      <div className={styles.podiumHeader}>📞 Setter Standings</div>
      <div className={styles.podiumRows}>
        {setters.map((s, i) => {
          const meta = RANK_META[i] ?? RANK_META[2];
          const name = s.profile.displayName ?? s.profile.setter;
          const initial = name.slice(0, 2).toUpperCase();
          return (
            <div
              key={s.profile.setter}
              className={`${styles.podiumRow} ${styles[meta.cls]}`}
            >
              <span className={styles.podiumMedal} aria-hidden="true">
                {meta.medal}
              </span>
              <div className={styles.podiumAvatar}>
                {s.profile.imageUrl ? (
                  <img src={s.profile.imageUrl} alt={name} />
                ) : (
                  <span>{initial}</span>
                )}
              </div>
              <div className={styles.podiumInfo}>
                <div className={styles.podiumName}>{name}</div>
                <div className={styles.podiumSub}>
                  {fmtInt(s.bookings)} booked · {fmtPct(s.showRate)} show ·{" "}
                  {fmtPct(s.closeRate)} close
                </div>
              </div>
              <div className={styles.podiumPoints}>
                <div className={styles.podiumPointsVal}>{fmtInt(s.points)}</div>
                <div className={styles.podiumPointsLbl}>PTS</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
