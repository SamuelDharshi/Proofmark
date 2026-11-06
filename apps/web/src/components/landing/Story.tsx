"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useScroll, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Sponsors } from "../Sponsors";
import { IsoCubes } from "../deco/IsoCubes";
import { GradBars, PixelArrow, PixelMark } from "../deco/Pixels";

const ease = [0.22, 1, 0.36, 1] as const;
const rise = (delay = 0) => ({
  initial: { opacity: 0, y: 34 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.3 },
  transition: { duration: 0.7, ease, delay },
});

/* ------------------------------------------------------------------ hero */
function Hero() {
  return (
    <section className="grid-lines relative min-h-screen overflow-hidden">
      <IsoCubes size={78} className="absolute -right-28 -top-4 hidden h-[640px] w-[700px] md:block" />
      <div className="wrap relative flex min-h-screen flex-col justify-between pb-0 pt-28">
        <div>
          <motion.p {...rise(0.05)} className="eyebrow inline-block"><span className="hl">An MCP trust gate</span></motion.p>
          <motion.div {...rise(0.12)} className="mt-9"><PixelMark /></motion.div>
          <h1 className="mt-8 text-[clamp(42px,6.4vw,96px)] font-medium leading-[1.04] tracking-[-0.035em]">
            <motion.span {...rise(0.18)} className="block"><span className="hl">Verifying</span></motion.span>
            <motion.span {...rise(0.26)} className="block text-[#767270]">the human behind</motion.span>
            <motion.span {...rise(0.34)} className="block font-pixel tracking-[-0.02em]">every MCP server</motion.span>
          </h1>
          <motion.p {...rise(0.42)} className="mt-8 max-w-[520px] text-[19px] text-muted">
            Agents pay $0.002 over x402 on Hedera, and are refused the moment a server's tools change.
          </motion.p>
          <motion.div {...rise(0.5)} className="mt-8"><Sponsors tone="dark" /></motion.div>
        </div>

        <motion.div {...rise(0.55)} className="-mx-4 mt-12 flex flex-wrap items-stretch border-t border-line bg-[#dedddb] sm:-mx-0">
          <Link href="/check" className="btn btn-primary !min-h-[56px] w-full sm:w-[280px]">Check a server</Link>
          <Link href="/marketplace" className="btn !min-h-[56px] w-full text-text hover:bg-surface-2 sm:w-auto">Browse marketplace</Link>
          <Link href="/claim" className="btn !min-h-[56px] w-full text-text hover:bg-surface-2 sm:w-auto">Claim yours</Link>
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- the gate */
const CHECKS = [
  { n: "01", title: "Pay over x402", body: "The proxy pays $0.002 in HBAR through a Hedera facilitator. A server that cannot be paid cannot be reached.", to: "/docs#hedera", tag: "Hedera" },
  { n: "02", title: "Read ENS, not a database", body: "Maintainer, price and the live attest key are records on proofmark.eth. Revoking is one on-chain write.", to: "/docs#ens", tag: "ENSv2" },
  { n: "03", title: "One human, one claim", body: "World ID proves a person stands behind the server. Agents carry a World Agent Pass bound to their ENS name.", to: "/docs#world", tag: "World" },
  { n: "04", title: "Hash the tools themselves", body: "The tool manifest is derived inside a no-network sandbox and compared on every connect and every list change.", to: "/docs#mcp", tag: "MCP" },
];
const CHIPS = ["x402", "ENSv2", "World ID", "HCS", "Sandbox", "Typosquats"];

function Gate() {
  return (
    <section className="grid-lines border-t border-line py-28 md:py-36">
      <div className="wrap">
        <motion.p {...rise()} className="eyebrow">The gate</motion.p>
        <motion.h2 {...rise(0.06)} className="mt-6 max-w-[900px] text-[clamp(40px,6vw,88px)] font-medium leading-[1.02] tracking-[-0.03em]">
          Four checks before an agent connects
        </motion.h2>
        <motion.div {...rise(0.12)} className="mt-9"><PixelMark /></motion.div>

        <div className="mt-16 grid gap-px bg-line md:grid-cols-2 lg:grid-cols-4">
          {CHECKS.map((c, i) => (
            <motion.article key={c.n} {...rise(i * 0.07)} className="group grain relative flex min-h-[420px] flex-col justify-between p-7">
              <div>
                <p className="font-pixel text-[15px] text-muted">{c.n}</p>
                <h3 className="mt-8 text-[28px] font-medium leading-[1.08] tracking-[-0.02em]">{c.title}</h3>
                <p className="mt-5 text-[15px] text-muted">{c.body}</p>
              </div>
              <Link href={c.to} className="-mx-7 -mb-7 mt-8 flex items-center justify-between bg-accent px-7 py-3.5 font-label text-[13px] uppercase tracking-[0.1em] text-accent-ink transition-[padding] duration-300 group-hover:pr-10">
                {c.tag} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </motion.article>
          ))}
        </div>

        <motion.ul {...rise()} className="mt-10 flex flex-wrap gap-2.5">
          {CHIPS.map((c) => (
            <li key={c} className="border border-line-strong px-4 py-1.5 font-label text-[13px] uppercase tracking-[0.08em]">{c}</li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- how it plays */
const BEATS = [
  { n: "01", t: "Connect", d: "The proxy pays over x402, reads the ENS records, checks both hashes, and only then opens the server." },
  { n: "02", t: "Attack", d: "A new tool, read_env, appears that was never attested. The connection is refused before the model sees the list." },
  { n: "03", t: "Revoke", d: "A co-maintainer key is an ENS subname. Clear it and every agent blocks on its next check." },
];

function Beats() {
  return (
    <section className="dark-zone grid-lines py-28 md:py-36">
      <div className="wrap">
        <motion.p {...rise()} className="eyebrow">How a connection plays out</motion.p>
        <ol className="mt-16">
          {BEATS.map((b, i) => (
            <motion.li key={b.n} {...rise(i * 0.05)} className="grid items-baseline gap-4 border-t border-line py-12 md:grid-cols-[220px_1fr_1.2fr] md:gap-10">
              <span className="font-pixel text-[clamp(56px,8vw,112px)] leading-none text-accent">{b.n}</span>
              <h3 className="text-[clamp(32px,4vw,56px)] font-medium tracking-[-0.03em]">{b.t}</h3>
              <p className="max-w-[460px] text-[17px] text-muted">{b.d}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- vision */
function Vision() {
  return (
    <section className="dark-zone grid-lines relative overflow-hidden border-t border-line py-32 md:py-44">
      <div className="wrap relative">
        <motion.p {...rise()} className="eyebrow">What we protect</motion.p>
        <motion.h2 {...rise(0.08)} className="mt-8 max-w-[1000px] text-[clamp(44px,7.4vw,112px)] font-medium leading-[1.03] tracking-[-0.035em]">
          A human still backs this <span className="text-[#767270]">server.</span>
        </motion.h2>
        <motion.div {...rise(0.16)} className="mt-12"><PixelMark /></motion.div>
        <GradBars className="absolute right-4 top-6 hidden md:block" />
      </div>
    </section>
  );
}

/* -------------------------------------------------------- horizontal tiers */
const CARDS = [
  { t: "Green", c: "text-accent", d: "Claimed, attested, both hashes match, key live. The full tool set opens." },
  { t: "Sandboxed", c: "text-sandbox", d: "No human has claimed it. It runs in a container with read-only tools." },
  { t: "Blocked", c: "text-danger", d: "Hash mismatch, revoked key or a typosquat. The connection is refused." },
  { t: "Not a safety proof", c: "", d: "Proofmark shows who stands behind a tool. It does not prove the code is safe." },
  { t: "Every payment on-chain", c: "", d: "Attestations and payments are anchored to a Hedera topic anyone can read." },
];

function Tiers() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0, 1], ["4%", "-66%"]);
  const [idx, setIdx] = useState(1);
  useMotionValueEvent(scrollYProgress, "change", (v) => setIdx(Math.min(CARDS.length, Math.floor(v * CARDS.length) + 1)));

  return (
    <section ref={ref} className="grid-lines relative h-[360vh] border-t border-line">
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
        <div className="wrap mb-10 flex items-end justify-between">
          <div>
            <p className="eyebrow">Three tiers. No amber.</p>
            <p className="num mt-4 text-[18px]"><span className="font-medium">{String(idx).padStart(2, "0")}</span><span className="text-muted">/{String(CARDS.length).padStart(2, "0")}</span></p>
          </div>
          <div className="flex gap-3 text-text"><PixelArrow dir="left" className="h-12 w-12" /><PixelArrow className="h-12 w-12" /></div>
        </div>
        <motion.div style={{ x }} className="flex gap-6 pl-[max(1rem,calc((100vw-1160px)/2))]">
          {CARDS.map((c) => (
            <article key={c.t} className="grain flex h-[min(54vh,440px)] w-[min(78vw,560px)] shrink-0 flex-col justify-between p-8">
              <h3 className={`text-[clamp(30px,3.4vw,46px)] font-medium leading-[1.05] tracking-[-0.03em] ${c.c}`}>{c.t}</h3>
              <p className="max-w-[380px] text-[18px] text-muted">{c.d}</p>
            </article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- partners */
const PARTNERS = [
  { name: "Hedera", href: "/docs#hedera", src: "/brands/hedera-wordmark-dark.png", w: 220, h: 45, note: "x402 payments and the HCS log" },
  { name: "ENS", href: "/docs#ens", src: "/brands/ens-wordmark-dark.png", w: 150, h: 45, note: "ENSv2 names and per-org resolvers" },
  { name: "World", href: "/docs#world", src: "/brands/world-wordmark-dark.png", w: 180, h: 47, note: "Proof of Human and Agent Pass" },
  { name: "Model Context Protocol", href: "/docs#mcp", src: "/brands/mcp-black.svg", w: 64, h: 64, note: "The registry and the wire protocol" },
];

function Partners() {
  return (
    <section className="grid-lines border-t border-line py-28 md:py-36">
      <div className="wrap">
        <motion.p {...rise()} className="eyebrow">Developing with the best</motion.p>
        <div className="mt-14 grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
          {PARTNERS.map((p, i) => (
            <motion.div key={p.name} {...rise(i * 0.06)}>
              <Link href={p.href} className="grain group flex h-[300px] flex-col items-center justify-center gap-6 p-6 transition-colors hover:bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.src} alt={p.name} width={p.w} height={p.h} style={{ width: p.w, height: p.h, objectFit: "contain", maxWidth: "80%" }} className="transition-transform duration-300 group-hover:scale-105" />
                <span className="text-center text-[14px] text-muted">{p.note}</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- CTA */
function Cta() {
  return (
    <section className="dark-zone grid-lines relative overflow-hidden border-t border-line py-28 md:py-36">
      <div className="wrap relative">
        <motion.p {...rise()} className="eyebrow">Your server</motion.p>
        <motion.h2 {...rise(0.08)} className="mt-6 max-w-[860px] text-[clamp(40px,6vw,88px)] font-medium leading-[1.02] tracking-[-0.03em]">
          Claim it and let agents <span className="text-accent">trust</span> it.
        </motion.h2>
        <motion.div {...rise(0.16)} className="mt-12 flex flex-wrap gap-3">
          <Link href="/claim" className="btn btn-primary !min-h-[56px] !px-10">Claim a server</Link>
          <Link href="/docs" className="btn btn-ghost !min-h-[56px] !px-10">Read the docs</Link>
        </motion.div>
      </div>
    </section>
  );
}

export function Story() {
  return (
    <>
      <Hero />
      <Gate />
      <Beats />
      <Vision />
      <Tiers />
      <Partners />
      <Cta />
    </>
  );
}
