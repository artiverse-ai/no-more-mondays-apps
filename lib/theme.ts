// Dark-mode theme plumbing.
//
// Cookie-backed so the server can render the right `dark` class on
// <html> on first paint (no flash). Three states:
//
//   "light" (default) — force light, regardless of OS preference.
//   "system"          — follow the OS prefers-color-scheme preference.
//                       Resolved client-side via matchMedia and an
//                       inline pre-paint script in app/layout.tsx.
//   "dark"            — force dark.
//
// Default is "light" so first-time visitors land in day mode even if
// their OS is set to dark. The toggle lets them switch.

"use server";

import { cookies } from "next/headers";

export type Theme = "system" | "light" | "dark";

const COOKIE = "nmm-theme";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function getTheme(): Promise<Theme> {
  try {
    const jar = await cookies();
    const v = jar.get(COOKIE)?.value;
    if (v === "light" || v === "dark" || v === "system") return v;
    return "light";
  } catch {
    // Outside request context (static gen). Default to light.
    return "light";
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
