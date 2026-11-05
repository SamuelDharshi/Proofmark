"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Box, ShieldCheck, ShieldX } from "lucide-react";

const TIERS = [
  { Icon: ShieldCheck, name: "Green", color: "text-accent", ring: "group-hover:border-accent/40", body: "Claimed, attested, both hashes match, key live. Full tool set." },
  { Icon: Box, name: "Sandboxed", color: "text-sandbox", ring: "group-hover:border-sandbox/40", body: "No human has claimed it. Runs in a container, read-only tools." },
  { Icon: ShieldX, name: "Blocked", color: "text-danger", ring: "group-hover:border-danger/40", body: "Hash mismatch, revoked key or a typosquat. Connection refused." },
];

export function Tiers() {
  return (
    <section className="relative z-10 bg-bg py-28">
      <div className="wrap">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.45 }}
          className="max-w-[560px] font-hero text-[clamp(36px,4.6vw,60px)] leading-[1.04]"
        >
          Three tiers. No amber.
        </motion.h2>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {TIERS.map(({ Icon, name, color, ring, body }, i) => (
            <motion.div
              key={name}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className={`group card card-hover p-6 ${ring}`}
            >
              <span className={`grid h-11 w-11 place-items-center rounded-xl border border-line-strong bg-surface-2 ${color}`}>
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-6 font-display text-[22px] font-semibold">{name}</h3>
              <p className="mt-2 text-[15px] text-muted">{body}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-20 flex flex-wrap items-center justify-between gap-6 rounded-[var(--radius-card)] border border-line bg-surface p-8">
          <p className="max-w-[520px] font-hero text-[clamp(28px,3.2vw,40px)] leading-[1.1]">
            This proves who stands behind a tool. It does not prove the code is safe.
          </p>
          <Link href="/marketplace" className="btn btn-primary">
            Open the marketplace <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
