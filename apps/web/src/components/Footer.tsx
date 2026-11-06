import Link from "next/link";
import { ExternalLink, Github } from "lucide-react";
import { LogoMark } from "./Logo";

type L = { l: string; h: string; x?: boolean };
const COLS: { title: string; links: L[] }[] = [
  {
    title: "Ecosystem",
    links: [
      { l: "Hedera", h: "https://hedera.com", x: true },
      { l: "ENS", h: "https://ens.domains", x: true },
      { l: "World ID", h: "https://world.org", x: true },
      { l: "MCP", h: "https://modelcontextprotocol.io", x: true },
      { l: "x402", h: "https://x402.org", x: true },
      { l: "Sepolia", h: "https://sepolia.etherscan.io", x: true },
      { l: "HashScan", h: "https://hashscan.io/testnet", x: true },
      { l: "Blocky402", h: "https://api.testnet.blocky402.com", x: true },
    ],
  },
  {
    title: "Resources",
    links: [
      { l: "Docs", h: "/docs" },
      { l: "Pitch decks", h: "/pitch" },
      { l: "Check a server", h: "/check" },
      { l: "HCS log", h: "/log" },
      { l: "MCP registry", h: "https://registry.modelcontextprotocol.io", x: true },
      { l: "ENS app", h: "https://sepolia.app.ens.domains", x: true },
    ],
  },
  {
    title: "Product",
    links: [
      { l: "Marketplace", h: "/marketplace" },
      { l: "Claim a server", h: "/claim" },
      { l: "Fleet", h: "/fleet" },
    ],
  },
  {
    title: "Community",
    links: [
      { l: "GitHub", h: "https://github.com/SamuelDharshi/Proofmark", x: true },
      { l: "ETHGlobal", h: "https://ethglobal.com", x: true },
    ],
  },
];

/** Charcoal footer on a visible grid, the textured cube resting in the corner, black copyright bar. */
export function Footer() {
  return (
    <footer className="dark-zone grid-lines relative overflow-hidden">
      <div className="relative mx-auto grid max-w-[1700px] gap-12 px-6 pb-[460px] pt-8 md:grid-cols-[1.9fr_repeat(4,1fr)] md:px-10 md:pb-[200px]">
        <Link href="/" aria-label="Proofmark home" className="inline-flex h-12 items-center gap-3 self-start text-text">
          <LogoMark className="h-11 w-11" tone="light" />
          <span className="text-[38px] font-medium leading-none tracking-[-0.03em]">proofmark</span>
        </Link>
        {COLS.map((c) => (
          <nav key={c.title} aria-label={c.title} className="md:pl-8">
            <h3 className="eyebrow !text-[22px] text-accent">{c.title}</h3>
            <ul className="mt-10 space-y-3.5">
              {c.links.map((k) => (
                <li key={k.l}>
                  {k.x ? (
                    <a href={k.h} target="_blank" rel="noreferrer" className="inline-block text-[22px] font-medium tracking-[-0.02em] text-text transition-colors hover:text-muted">{k.l}</a>
                  ) : (
                    <Link href={k.h} className="inline-block text-[22px] font-medium tracking-[-0.02em] text-text transition-colors hover:text-muted">{k.l}</Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/art/foot.webp" alt="" width={1200} height={1247} loading="lazy" decoding="async" className="pointer-events-none absolute bottom-0 left-0 w-[min(400px,70vw)]" />
      <span aria-hidden className="absolute bottom-[62px] right-0 hidden h-10 w-10 md:block" style={{ background: "linear-gradient(135deg,#facc15 50%,#22d3ee 50%)" }} />

      <div className="relative ml-0 bg-black md:ml-[min(400px,30vw)]">
        <div className="mx-auto flex max-w-[1700px] flex-wrap items-center justify-between gap-4 px-6 py-5 text-[20px] font-medium text-white md:px-10">
          <span className="flex-1 text-center md:pl-24">© 2026 Proofmark. All rights reserved.</span>
          <span className="flex items-center gap-6">
            <a href="https://github.com/SamuelDharshi/Proofmark" target="_blank" rel="noreferrer" aria-label="GitHub" className="hover:text-accent"><Github className="h-6 w-6" /></a>
            <Link href="/docs" aria-label="Docs" className="hover:text-accent"><ExternalLink className="h-6 w-6" /></Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
