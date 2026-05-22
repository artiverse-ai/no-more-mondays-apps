import Link from "next/link";
import type { Period } from "../_lib/scoring";
import styles from "./competition.module.css";

/** Segmented toggle that flips the competition between the Closer
 *  leaderboard (/competition) and the Setter leaderboard
 *  (/competition/setter). The active period carries across. */
export function ViewToggle({
  active,
  period,
}: {
  active: "closer" | "setter";
  period: Period;
}) {
  const views = [
    { key: "closer", label: "Closers", emoji: "🏆", path: "/competition" },
    { key: "setter", label: "Setters", emoji: "📞", path: "/competition/setter" },
  ] as const;
  return (
    <div className={styles.viewToggle}>
      {views.map((v) => (
        <Link
          key={v.key}
          href={`${v.path}?period=${period}`}
          className={`${styles.viewToggleBtn} ${v.key === active ? styles.viewToggleActive : ""}`}
          scroll={false}
        >
          <span aria-hidden>{v.emoji}</span> {v.label}
        </Link>
      ))}
    </div>
  );
}
