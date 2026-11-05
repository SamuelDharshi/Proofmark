"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ArrowUpRight, FileClock, ShieldPlus, Store } from "lucide-react";
import { Wordmark } from "./Logo";

const NAV = [
  { href: "/fleet", label: "Fleet", Icon: Activity },
  { href: "/claim", label: "Claim", Icon: ShieldPlus },
  { href: "/log", label: "HCS log", Icon: FileClock },
  { href: "/marketplace", label: "Marketplace", Icon: Store },
];

/** Tool pages have no hero, so they get a persistent shell instead of the marketing navbar. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="min-h-screen md:grid md:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-bg/80 px-4 py-3 backdrop-blur-xl md:h-screen md:flex-col md:items-stretch md:gap-8 md:border-b-0 md:border-r md:px-4 md:py-6">
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
                className={`flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3 font-label text-[14px] transition-colors ${active ? "bg-surface-2 text-text ring-1 ring-line-strong" : "text-muted hover:bg-surface hover:text-text"}`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        <Link href="/docs" className="link hidden items-center gap-1.5 px-3 text-[13px] text-muted hover:text-text md:inline-flex">
          Docs <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </aside>
      <main className="min-w-0 px-4 py-8 md:px-10 md:py-10">{children}</main>
    </div>
  );
}
