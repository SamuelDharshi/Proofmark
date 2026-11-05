"use client";
import { motion } from "framer-motion";
import { Bot, ShieldAlert, ShieldCheck } from "lucide-react";
import { ExplorerLink } from "../ExplorerLink";
import { ago, usd } from "@/lib/format";
import type { FleetAgent } from "@/lib/api";

export function AgentCard({ a, onPass }: { a: FleetAgent; onPass: (valid: boolean) => void }) {
  const used = a.budgetUsd ? Math.min(1, a.spentUsd / a.budgetUsd) : 0;
  const ok = a.pass.valid;
  return (
    <motion.div layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="card card-hover relative overflow-hidden p-5">
      <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${ok ? "var(--color-accent)" : "var(--color-danger)"}, transparent)` }} />
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line-strong bg-surface-2 ${ok ? "text-accent" : "text-danger"}`}>
            <Bot className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-[17px] font-semibold">{a.ensName}</p>
            <ExplorerLink k={{ type: "hedera-account", id: a.hederaAccount }} />
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-label text-[12px] ${ok ? "border-accent/30 bg-accent/10 text-accent" : "border-danger/30 bg-danger/10 text-danger"}`}>
          {ok ? <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> : <ShieldAlert className="h-3.5 w-3.5" aria-hidden />}
          {ok ? "Pass valid" : "Pass denied"}
        </span>
      </div>

      <p className="mt-4 text-[13px] text-muted">{a.pass.message}{a.pass.mode === "mock" ? " (mock)" : ""}</p>

      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-[12px] text-muted">
          <span>Budget</span>
          <span className="num">{usd(a.spentUsd)} / {usd(a.budgetUsd)}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
          <motion.div className="h-full rounded-full bg-accent" initial={false} animate={{ width: `${used * 100}%` }} transition={{ duration: 0.5 }} />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
        <p className="min-w-0 truncate text-[12.5px] text-faint">{a.last ? `${a.last.kind} · ${ago(a.last.ts)}` : "No activity"}</p>
        <button className="btn btn-ghost !min-h-9 !px-3 !text-[13px]" onClick={() => onPass(!a.passValid)}>
          {a.passValid ? "Expire pass" : "Restore pass"}
        </button>
      </div>
    </motion.div>
  );
}
