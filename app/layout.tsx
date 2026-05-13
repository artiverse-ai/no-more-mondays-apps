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
import { NavProgress } from "@/components/NavProgress";
import "./globals.css";

// Inter is the primary UI font (closest open match to SF Pro). The
// font-sans CSS var puts -apple-system / "SF Pro Text" ahead of Inter so
// macOS / iOS get native SF rendering, then Windows / Linux fall to Inter.
// See app/globals.css :root --font-sans.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  // Inter's variable axes (weight/optical) auto-pick; explicit weights
  // declared so we can use 300/400/500/600/700 without extra fetches.
  weight: ["300", "400", "500", "600", "700"],
});

// Kept as a fallback in the font-sans stack — Geist is already cached for
// any returning visitor on the dashboards.
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${inter.variable} ${geistSans.variable} ${geistMono.variable} ${syne.variable} ${outfit.variable} ${jetbrainsMono.variable} h-full antialiased`}
        // Browser extensions (screen recorders, etc.) inject attributes onto
        // <html> before React hydrates — ignore the resulting attribute diff.
        suppressHydrationWarning
      >
        <body className="min-h-full flex flex-col">
          <Suspense fallback={null}>
            <NavProgress />
          </Suspense>
          <Breadcrumbs />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
