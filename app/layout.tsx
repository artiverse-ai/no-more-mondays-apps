import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        // Browser extensions (screen recorders, etc.) inject attributes onto
        // <html> before React hydrates — ignore the resulting attribute diff.
        suppressHydrationWarning
      >
        <body className="min-h-full flex flex-col">
          <Breadcrumbs />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
