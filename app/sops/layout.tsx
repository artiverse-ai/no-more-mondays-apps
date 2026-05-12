import { Playfair_Display } from "next/font/google";
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
      {children}
    </div>
  );
}
