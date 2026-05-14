import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Inter,
  JetBrains_Mono,
  Outfit,
  Syne,
} from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import { NavProgress } from "@/components/NavProgress";
import { TooltipProvider } from "@/components/ui/tooltip-provider";
import { NavProgressProvider } from "@/lib/nav-progress-context";
import { getTheme } from "@/lib/theme";
import "./globals.css";

// Inter is the primary UI font (closest open match to SF Pro). The
// font-sans CSS var puts -apple-system / "SF Pro Text" ahead of Inter so
// macOS / iOS get native SF rendering, then Windows / Linux fall to Inter.
// See app/globals.css :root --font-sans.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Fonts used by the Weekly Report dashboard. Loaded here so they're
// globally available as CSS vars; next/font keeps them subsetted and only
// served when actually referenced.
const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "No More Mondays",
  description: "Internal apps and dashboards for No More Mondays.",
  robots: { index: false, follow: false },
};

// Inline pre-paint script: synchronously resolves the effective theme
// (cookie + prefers-color-scheme) and toggles the `dark` class on
// <html> BEFORE the browser paints, eliminating the dark-mode FOUC on
// system-pref users + dark cookie users. Mirrors `applyThemeClass()` in
// components/DarkModeToggle.tsx.
const THEME_INIT_SCRIPT = `(function(){try{var m=document.cookie.match(/nmm-theme=([^;]+)/);var t=m?m[1]:"system";var dark=t==="dark"||(t==="system"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);var c=document.documentElement.classList;if(dark){c.add("dark");}else{c.remove("dark");}}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read the persisted theme on the server. For "system" we leave the
  // `dark` class off and let the inline script + a client listener
  // (inside <DarkModeToggle>) handle live OS-preference changes.
  const theme = await getTheme();
  const htmlIsDark = theme === "dark";

  return (
    <ClerkProvider>
      <html
        lang="en"
        className={
          `${inter.variable} ${geistSans.variable} ${geistMono.variable} ${syne.variable} ${outfit.variable} ${jetbrainsMono.variable} h-full antialiased` +
          (htmlIsDark ? " dark" : "")
        }
        // Browser extensions (screen recorders, etc.) inject attributes onto
        // <html> before React hydrates — ignore the resulting attribute diff.
        // The inline pre-paint script may also add the `dark` class for
        // system-pref users, which would otherwise trigger a hydration diff.
        suppressHydrationWarning
      >
        <body className="min-h-full flex flex-col">
          {/* Pre-paint theme reconciliation — first thing in body so it
              runs synchronously before the browser paints anything else. */}
          <script
            dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
          />
          <NavProgressProvider>
            <Suspense fallback={null}>
              <NavProgress />
            </Suspense>
            <TooltipProvider>
              <Breadcrumbs
                rightSlot={<DarkModeToggle current={theme} />}
              />
              {children}
            </TooltipProvider>
          </NavProgressProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
