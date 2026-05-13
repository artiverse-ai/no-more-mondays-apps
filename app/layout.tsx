import type { Metadata } from "next";
import { Geist, Geist_Mono, JetBrains_Mono, Outfit, Syne } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { NavProgress } from "@/components/NavProgress";
import "./globals.css";

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
        className={`${geistSans.variable} ${geistMono.variable} ${syne.variable} ${outfit.variable} ${jetbrainsMono.variable} h-full antialiased`}
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
