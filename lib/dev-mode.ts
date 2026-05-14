// Dev ↔ Executive mode plumbing.
//
// Executive mode (default): tooltips show plain-English description +
// formula. Good for non-technical viewers.
//
// Developer mode (opt-in, admin-only): tooltips also reveal the SQL
// snippet and source mart/view. Useful for the analytics team while
// debugging a metric.
//
// Cookie-backed so server components can render the right tooltip
// content on first paint (no localStorage flicker). The toggle button
// calls `toggleDevMode()` as a server action then refreshes the route.

"use server";

import { cookies } from "next/headers";

const COOKIE = "nmm-dev-mode";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function getDevMode(): Promise<boolean> {
  try {
    const jar = await cookies();
    return jar.get(COOKIE)?.value === "1";
  } catch {
    // Outside a request context (e.g. during static gen) — exec mode wins.
    return false;
  }
}

export async function setDevMode(on: boolean): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, on ? "1" : "0", {
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
    httpOnly: false, // intentionally readable from client-side analytics later
    path: "/",
  });
}

export async function toggleDevMode(): Promise<boolean> {
  const current = await getDevMode();
  await setDevMode(!current);
  return !current;
}
