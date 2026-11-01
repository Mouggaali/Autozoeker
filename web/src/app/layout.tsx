import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import ScrollEngine from "@/components/ScrollEngine";
import World from "@/components/World";
import "./globals.css";

const geist = Geist({ variable: "--ff-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--ff-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AutoZoeker – Check een auto op kenteken",
  description: "Analyseer een auto op kenteken: RDW-gegevens, APK-historie, live marktprijzen NL/DE, BPM, maandkosten en een score van 1 tot 10.",
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#060a12" }, { media: "(prefers-color-scheme: light)", color: "#e8ecf4" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={`${geist.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full">
        <World />
        <header className="bar">
          <Link href="/" className="glass flex items-center gap-2.5 py-2 pr-4 pl-2.5" style={{ borderRadius: 999 }}>
            <span className="plate px-2 py-0.5 text-xs" style={{ borderLeftWidth: 10 }}>AZ</span>
            <span className="font-display text-[15px] font-semibold tracking-tight">AutoZoeker</span>
          </Link>
          <span className="glass hidden px-4 py-2.5 text-xs font-medium text-muted sm:block" style={{ borderRadius: 999 }}>Onafhankelijk · RDW · live markt</span>
        </header>
        <div className="app flex min-h-full flex-col">
          <main className="flex-1 pt-[calc(72px+env(safe-area-inset-top))]">{children}</main>
          <footer className="mx-auto w-full max-w-6xl px-4 pt-12 pb-8">
            <div className="flex flex-col gap-2 border-t border-line pt-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
              <span className="font-semibold">AutoZoeker</span>
              <span>Gegevens: RDW Open Data, Marktplaats en AutoScout24. Indicatief; geen taxatie of financieel advies.</span>
            </div>
          </footer>
        </div>
        <ScrollEngine />
      </body>
    </html>
  );
}
