"use client";

import { useEffect, useState } from "react";
import styles from "./competition.module.css";

/** Theatrical 1.5s intro on first session visit only. Stores a flag in
 *  sessionStorage so closers reloading 20×/day don't get the splash
 *  every time — just on the first load of the browser session. Click /
 *  any key dismisses early. */
export function SplashIntro() {
  const [phase, setPhase] = useState<"hidden" | "showing" | "fading">("hidden");

  useEffect(() => {
    // SSR-safe: only access sessionStorage in the browser
    if (typeof window === "undefined") return;
    const KEY = "competition:splash:seen";
    if (sessionStorage.getItem(KEY) === "1") return;  // already seen this session
    setPhase("showing");
    const fadeTimer = setTimeout(() => setPhase("fading"), 1500);
    const doneTimer = setTimeout(() => {
      setPhase("hidden");
      sessionStorage.setItem(KEY, "1");
    }, 2200);  // 1500ms show + 700ms fade
    return () => { clearTimeout(fadeTimer); clearTimeout(doneTimer); };
  }, []);

  const skip = () => {
    if (typeof window !== "undefined") sessionStorage.setItem("competition:splash:seen", "1");
    setPhase("hidden");
  };

  // Skip with any key or click anywhere on the overlay
  useEffect(() => {
    if (phase === "hidden") return;
    const handler = () => skip();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (phase === "hidden") return null;
  const fadeClass = phase === "fading" ? styles.splashFadeOut : "";
  return (
    <div className={`${styles.splash} ${fadeClass}`} onClick={skip} role="dialog" aria-label="Welcome to The No More Mondays Games">
      <img src="/competition/poster.png" alt="The No More Mondays Games" className={styles.splashPoster} />
      <button className={styles.splashSkip} onClick={skip} aria-label="Skip intro">Skip ×</button>
    </div>
  );
}
