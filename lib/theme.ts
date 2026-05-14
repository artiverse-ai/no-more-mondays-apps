// Dark-mode theme plumbing.
//
// Cookie-backed so the server can render the right `dark` class on
// <html> on first paint (no flash). Three states:
//
//   "system" (default) — follow the OS prefers-color-scheme preference.
//                        Resolved client-side via matchMedia and an
//                        inline pre-paint script in app/layout.tsx.
//   "light"            — force light, regardless of OS preference.
//   "dark"             — force dark.
//
// The toggle (components/DarkModeToggle.tsx) cycles
// system → light → dark → system.

"use server";

import { cookies } from "next/headers";

export type Theme = "system" | "light" | "dark";

const COOKIE = "nmm-theme";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function getTheme(): Promise<Theme> {
  try {
    const jar = await cookies();
    const v = jar.get(COOKIE)?.value;
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    // Outside request context (static gen). Default to system.
    return "system";
  }
}

export async function setTheme(theme: Theme): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, theme, {
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
    httpOnly: false, // intentionally readable from the inline pre-paint script
    path: "/",
  });
}
