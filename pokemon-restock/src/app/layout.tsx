import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "RestockRadar — Pokemon TCG at retail price",
  description:
    "Track Pokemon TCG restocks across major retailers and see instantly what is available at or below MSRP.",
};

const NAV = [
  { href: "/", label: "Board" },
  { href: "/restocks", label: "Restock feed" },
  { href: "/status", label: "Monitor" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="sticky top-0 z-30 border-b border-ink-700/70 bg-ink-950/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <Link href="/" className="flex items-center gap-2.5 shrink-0">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-bolt-500 text-lg font-black text-ink-950">
                ⚡
              </span>
              <span className="text-sm font-bold tracking-tight text-white sm:text-base">
                RestockRadar
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-2.5 py-1.5 text-slate-400 transition hover:bg-ink-800 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>

        <footer className="mx-auto max-w-6xl px-4 pb-10 pt-6 text-xs leading-relaxed text-slate-500">
          <p>
            RestockRadar tracks retail availability only. Prices and stock states in this
            deployment are <strong className="text-slate-400">simulated demo data</strong> unless a
            real retailer adapter has been configured — see the{" "}
            <Link href="/status" className="text-bolt-500 hover:underline">
              monitor page
            </Link>
            .
          </p>
          <p className="mt-1.5">
            Pokemon and the Pokemon TCG are trademarks of Nintendo / Creatures Inc. / GAME FREAK
            Inc. This project is not affiliated with them or with any retailer listed.
          </p>
        </footer>
      </body>
    </html>
  );
}
