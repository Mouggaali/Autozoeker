import type { Metadata } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AutoCheck – Check een auto op kenteken",
  description: "Analyseer een auto op kenteken: RDW-gegevens, APK-historie, marktwaarde NL/DE, BPM, maandkosten en een score van 1 tot 10.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-line bg-card">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">A</span>
              AutoCheck
            </Link>
            <nav className="text-sm text-muted">Onafhankelijke auto-analyse</nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line py-6 text-center text-xs text-muted">
          Gegevens: RDW Open Data. Schattingen zijn indicatief en geen taxatie of financieel advies.
        </footer>
      </body>
    </html>
  );
}
