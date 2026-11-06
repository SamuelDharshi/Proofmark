"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ArrowUpRight, FileClock, ShieldPlus, Store, Wrench } from "lucide-react";
import { Wordmark } from "./Logo";
import { DECKS } from "@/lib/pitch";

const NAV = [
  { href: "/fleet", label: "Fleet", Icon: Activity },
  { href: "/claim", label: "Claim", Icon: ShieldPlus },
  { href: "/maintain", label: "Maintain", Icon: Wrench },
  { href: "/log", label: "HCS log", Icon: FileClock },
  { href: "/marketplace", label: "Marketplace", Icon: Store },
];

/** Tool pages have no hero, so they get a persistent shell instead of the marketing navbar. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="min-h-screen md:grid md:grid-cols-[232px_1fr]">
      <aside className="dark-zone sticky top-0 z-30 flex items-center gap-2 border-b border-line px-4 py-3 md:h-screen md:flex-col md:items-stretch md:gap-8 md:border-b-0 md:border-r md:px-4 md:py-6">
        <Link href="/" aria-label="Proofmark home" className="px-2">
          <Wordmark />
        </Link>
        <nav className="flex flex-1 gap-1 overflow-x-auto md:flex-col" aria-label="App">
          {NAV.map(({ href, label, Icon }) => {
            const active = path === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex min-h-11 shrink-0 items-center gap-3 px-3 font-label text-[13px] uppercase tracking-[0.08em] transition-colors ${active ? "bg-accent text-accent-ink" : "text-muted hover:bg-surface hover:text-text"}`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </Link>
            );
          })}
          <div className="mt-6 hidden flex-col gap-1 border-t border-line pt-5 md:flex">
            <p className="px-3 font-label text-[11px] uppercase tracking-[0.12em] text-faint">Pitch decks</p>
            {DECKS.map((d) => (
              <Link key={d.id} href={`/pitch?deck=${d.id}`} className="group flex min-h-10 items-center justify-between gap-2 px-3 text-[13px] text-muted transition-colors hover:bg-surface hover:text-text">
                <span><span className="text-text">{d.sponsor}</span> · {d.track.split(":")[0].replace("Best Use of ", "")}</span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
              </Link>
            ))}
            <Link href="/pitch" className="link px-3 pt-1 text-[12px] text-muted hover:text-text">All three decks</Link>
          </div>
        </nav>
        <Link href="/docs" className="link hidden items-center gap-1.5 px-3 text-[13px] text-muted hover:text-text md:inline-flex">
          Docs <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </aside>
      <main className="grid-lines min-w-0 px-4 py-8 md:px-10 md:py-10">{children}</main>
    </div>
  );
}
