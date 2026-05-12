import { Playfair_Display } from "next/font/google";
import Link from "next/link";
import "./sops.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata = {
  title: "SOPs · No More Mondays",
};

export default function SopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${playfair.variable} sop-body min-h-screen`}>
      <nav className="border-b border-border/60 bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <Link
            href="/sops"
            className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent hover:opacity-80"
          >
            SOPs
          </Link>
          <Link
            href="/"
            className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
          >
            ← Home
          </Link>
        </div>
      </nav>
      {children}
    </div>
  );
}
