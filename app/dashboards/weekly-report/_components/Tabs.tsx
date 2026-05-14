"use client";

import { useState } from "react";
import styles from "./report.module.css";

type Tab = { id: string; label: string };

export function Tabs({
  tabs,
  defaultActive,
  panels,
}: {
  tabs: Tab[];
  defaultActive: string;
  panels: Record<string, React.ReactNode>;
}) {
  const [active, setActive] = useState(defaultActive);
  return (
    <>
      <div className={styles.tabNav}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActive(t.id)}
            className={`${styles.tb} ${active === t.id ? styles.tbActive : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) =>
        active === t.id ? (
          <div key={t.id} className={styles.pane}>
            {panels[t.id]}
          </div>
        ) : null,
      )}
    </>
  );
}
