import Link from "next/link";
import type { Period } from "../_lib/scoring";
import styles from "./competition.module.css";

const TABS: Array<{ key: Period; label: string }> = [
  { key: "today", label: "Today" },
  { key: "week",  label: "This Week" },
  { key: "month", label: "This Month" },
];

export function PeriodTabs({ active }: { active: Period }) {
  return (
    <div className={styles.periodTabsRow}>
      <div className={styles.periodTabs}>
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/competition?period=${t.key}`}
            className={`${styles.periodTab} ${t.key === active ? styles.periodTabActive : ""}`}
            scroll={false}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
