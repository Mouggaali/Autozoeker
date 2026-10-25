import type { Metadata } from "next";
import Link from "next/link";
import { Bricolage_Grotesque, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({ variable: "--ff-display", subsets: ["latin"], weight: ["500", "700", "800"] });
const body = Instrument_Sans({ variable: "--ff-body", subsets: ["latin"] });
const mono = IBM_Plex_Mono({ variable: "--ff-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "AutoZoeker – Check een auto op kenteken",
  description: "Analyseer een auto op kenteken: RDW-gegevens, APK-historie, live marktprijzen NL/DE, BPM, maandkosten en een score van 1 tot 10.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="group flex items-center gap-2.5">
              <span className="plate px-2 py-0.5 text-xs" style={{ borderLeftWidth: 10 }}>AZ</span>
              <span className="font-display text-lg font-extrabold tracking-tight">AutoZoeker</span>
            </Link>
            <nav className="eyebrow hidden sm:block">Onafhankelijk · RDW · live markt</nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="mt-12 border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
            <span className="eyebrow">AutoZoeker</span>
            <span>Gegevens: RDW Open Data, Marktplaats en AutoScout24. Indicatief; geen taxatie of financieel advies.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
