"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRef, useState } from "react";
import { motion, useMotionValue, useScroll, useSpring } from "framer-motion";
import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { Sponsors } from "../Sponsors";

const Scene = dynamic(() => import("../scene/Scene"), { ssr: false });

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { amount: 0.5, once: false },
  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
};

function Beat({ n, title, body, children }: { n: string; title: string; body: string; children?: React.ReactNode }) {
  return (
    <section className="flex min-h-screen items-center">
      <div className="wrap">
        <motion.div {...reveal} className="max-w-[440px]">
          <p className="font-pixel text-[13px] tracking-widest text-accent">{n}</p>
          <h2 className="mt-4 font-hero text-[clamp(40px,5.2vw,68px)] leading-[1.02]">{title}</h2>
          <p className="mt-5 text-[17px] text-muted">{body}</p>
          {children}
        </motion.div>
      </div>
    </section>
  );
}

/** One fixed canvas, driven by scroll. Hero, connect, attack, revoke. */
export function Story() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.4 });

  // Development only: ?p=0.4 pins the scene to a story beat for review.
  const pinned = useMotionValue(0);
  const [override, setOverride] = useState<string | null>(null);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const v = new URLSearchParams(window.location.search).get("p");
    if (v !== null) {
      setOverride(v);
      pinned.set(Number(v));
    }
  }, [pinned]);

  return (
    <div ref={ref} className="relative">
      <div className="pointer-events-none fixed inset-0 -z-0">
        <Scene progress={override !== null ? pinned : progress} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgba(10,11,13,0.78),transparent_60%)]" />
      </div>

      <div className="relative z-10">
        <section className="flex min-h-screen items-center">
          <div className="wrap pt-24">
            <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} className="max-w-[640px]">
              <p className="font-pixel text-[13px] tracking-widest text-accent">X402 · HEDERA · ENSV2 · WORLD ID</p>
              <h1 className="mt-5 font-hero text-[clamp(52px,7.4vw,104px)] leading-[0.96] tracking-[-0.01em]">
                Your agent just handed a stranger its shell.
              </h1>
              <p className="mt-6 max-w-[480px] text-[18px] text-muted">
                THANKS checks that a verified human still backs an MCP server before an agent connects. $0.002, no human in the loop.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/marketplace" className="btn btn-primary">
                  Browse servers <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link href="/check" className="btn btn-ghost">
                  Check a name
                </Link>
              </div>
              <div className="mt-14">
                <Sponsors />
              </div>
            </motion.div>
          </div>
        </section>

        <Beat n="01 / CONNECT" title="Pay. Verify. Connect." body="The proxy pays over x402 on Hedera, checks both hashes, and only then opens the server." />
        <Beat n="02 / ATTACK" title="A new tool appeared. The door shut." body="read_env was not in the attested manifest. The connection is refused before the model sees the tool list." />
        <Beat n="03 / REVOKE" title="One write. The fleet goes red." body="A co-maintainer key is an ENS subname. Revoke it and every agent blocks on its next check." />
      </div>
    </div>
  );
}
