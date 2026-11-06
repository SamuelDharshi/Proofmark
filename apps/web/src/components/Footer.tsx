import Link from "next/link";
import { LogoMark } from "./Logo";
import { IsoCubes } from "./deco/IsoCubes";
import { PixelMark } from "./deco/Pixels";
import { Sponsors } from "./Sponsors";

const COLS = [
  {
    title: "Protocol",
    links: [
      { l: "Marketplace", h: "/marketplace" },
      { l: "Check a server", h: "/check" },
      { l: "Claim a server", h: "/claim" },
      { l: "Fleet", h: "/fleet" },
      { l: "HCS log", h: "/log" },
    ],
  },
  {
    title: "Built on",
    links: [
      { l: "Hedera", h: "https://hedera.com", x: true },
      { l: "ENS", h: "https://ens.domains", x: true },
      { l: "World ID", h: "https://world.org", x: true },
      { l: "Model Context Protocol", h: "https://modelcontextprotocol.io", x: true },
    ],
  },
  {
    title: "Resources",
    links: [
      { l: "Docs", h: "/docs" },
      { l: "GitHub", h: "https://github.com/SamuelDharshi/Proofmark", x: true },
      { l: "MCP registry", h: "https://registry.modelcontextprotocol.io", x: true },
    ],
  },
  {
    title: "Network",
    links: [
      { l: "Hedera testnet", h: "https://hashscan.io/testnet", x: true },
      { l: "Sepolia", h: "https://sepolia.etherscan.io", x: true },
      { l: "ENS app", h: "https://sepolia.app.ens.domains", x: true },
    ],
  },
];

/** Charcoal footer on the five-column grid, with the isometric cluster resting in the corner. */
export function Footer() {
  return (
    <footer className="dark-zone grid-lines relative mt-0 overflow-hidden">
      <div className="wrap relative grid gap-10 pb-72 pt-16 md:grid-cols-[1.1fr_repeat(4,1fr)] md:pb-40">
        <div className="space-y-6">
          <Link href="/" aria-label="Proofmark home" className="inline-flex items-center gap-2.5 text-text">
            <LogoMark className="h-8 w-8" />
            <span className="text-[24px] font-semibold tracking-[-0.02em]">proofmark</span>
          </Link>
          <PixelMark className="scale-75 origin-left" />
          <p className="max-w-[210px] text-[14px] text-muted">A human still backs this server. Checked on Hedera, ENS and World.</p>
        </div>
        {COLS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h3 className="eyebrow text-accent">{c.title}</h3>
            <ul className="mt-6 space-y-3">
              {c.links.map((k) => (
                <li key={k.l}>
                  {k.x ? (
                    <a href={k.h} target="_blank" rel="noreferrer" className="link text-[16px] text-text">{k.l}</a>
                  ) : (
                    <Link href={k.h} className="link text-[16px] text-text">{k.l}</Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="wrap relative pb-24 md:pb-28 md:pl-[300px]">
        <Sponsors tone="light" label="Real marks" />
      </div>

      <IsoCubes size={64} className="pointer-events-none absolute -bottom-28 -left-16 h-[420px] w-[420px] opacity-95" />

      <div className="relative bg-black">
        <div className="wrap flex flex-wrap items-center justify-between gap-3 py-5 text-[14px] text-white">
          <span>© 2026 Proofmark. All rights reserved.</span>
          <span className="text-muted">Testnet only. Proves who stands behind a tool, not that the code is safe.</span>
        </div>
      </div>
    </footer>
  );
}
