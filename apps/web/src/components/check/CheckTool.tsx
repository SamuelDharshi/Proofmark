"use client";
import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Loader2, Search } from "lucide-react";
import type { CheckResult } from "@proofmark/core";
import { api } from "@/lib/api";
import { TierBadge, tierColor } from "../TierBadge";

const EXAMPLES = ["io.proofmark.demo/filesystem", "io.proofmark.demo/postgres", "com.example/anything"];

export function CheckTool({ initial = "" }: { initial?: string }) {
  const [q, setQ] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<CheckResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async (name: string) => {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    setErr(null);
    try {
      setRes(await api.check(n));
    } catch (e) {
      setErr((e as Error).message);
      setRes(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wrap pb-10 pt-32">
      <p className="font-pixel text-[13px] tracking-widest text-accent">CHECK</p>
      <h1 className="mt-3 max-w-[760px] font-hero text-[clamp(44px,6vw,84px)] leading-[0.98]">Resolve any server name.</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(q);
        }}
        className="mt-10 flex max-w-[720px] flex-col gap-3 sm:flex-row"
      >
        <label className="relative block flex-1">
          <span className="sr-only">Server name</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="io.github.acme/filesystem"
            className="num h-12 w-full rounded-xl border border-line bg-surface pl-10 pr-3 text-[15px] outline-none transition-colors placeholder:text-faint focus:border-accent/60"
          />
        </label>
        <button className="btn btn-primary h-12" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Check
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {EXAMPLES.map((x) => (
          <button key={x} onClick={() => { setQ(x); run(x); }} className="num rounded-lg border border-line px-3 py-1.5 text-[12.5px] text-muted transition-colors hover:border-line-strong hover:text-text">
            {x}
          </button>
        ))}
      </div>

      <div className="mt-10 max-w-[720px]">
        <AnimatePresence mode="wait">
          {err && <motion.p key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-6 text-danger">{err}</motion.p>}
          {res && (
            <motion.div key={res.server + res.checkedAt} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="card relative overflow-hidden p-6">
              <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${tierColor[res.tier]}, transparent)` }} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="num break-all text-[15px]">{res.server}</p>
                <TierBadge tier={res.tier} />
              </div>
              <p className="mt-4 text-[16px] text-muted">{res.explain}</p>
              <Link href={`/server/${res.server}`} className="link mt-5 inline-flex items-center gap-2 text-[14px] text-accent">
                Open inspector <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
