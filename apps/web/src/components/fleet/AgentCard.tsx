"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, ExternalLink, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { ExplorerLink } from "../ExplorerLink";
import { ago, usd } from "@/lib/format";
import { api, ApiError, type FleetAgent, type PassStart } from "@/lib/api";
import { useWallet } from "@/lib/useWallet";

const left = (expiresAt?: number) => {
  if (!expiresAt) return "";
  const s = Math.round(expiresAt - Date.now() / 1000);
  if (s <= 0) return "expired";
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m left`;
  return `${Math.round(s / 3600)}h left`;
};

type Phase = { t: "idle" } | { t: "signing" } | { t: "waiting"; start: PassStart } | { t: "error"; message: string } | { t: "done"; tx: string };

/** One agent: its ENS name, wallet, budget and Agent Pass. Renewing runs the official World device flow. */
export function AgentCard({ a, onChange }: { a: FleetAgent; onChange: () => void }) {
  const wallet = useWallet();
  const [phase, setPhase] = useState<Phase>({ t: "idle" });
  const [, tick] = useState(0);
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  const used = a.budgetUsd ? Math.min(1, a.spentUsd / a.budgetUsd) : 0;
  const ok = a.pass.valid;

  const signed = async (action: string) => {
    if (!wallet.address) {
      if (!(await wallet.connect())) throw new Error("Connect the ENS admin wallet or the agent wallet");
    }
    const ts = String(Date.now());
    return { ts, sig: await wallet.sign(`proofmark:${action}:${a.ensName}:${ts}`) };
  };

  const renew = async () => {
    try {
      setPhase({ t: "signing" });
      const { ts, sig } = await signed("pass-start");
      const start = await api.startPass(a.ensName, ts, sig);
      setPhase({ t: "waiting", start });
      let interval = start.interval;
      const deadline = Date.now() + start.expiresIn * 1000;
      while (alive.current && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, interval * 1000));
        const r = await api.pollPass(start.attemptId);
        if (r.status === "pending") interval = r.interval;
        else if (r.status === "approved") {
          setPhase({ t: "done", tx: r.tx });
          onChange();
          return;
        } else {
          setPhase({ t: "error", message: r.message });
          return;
        }
      }
      setPhase({ t: "error", message: "The approval window closed." });
    } catch (e) {
      setPhase({ t: "error", message: e instanceof ApiError ? e.message : (e as Error).message });
    }
  };

  const revoke = async () => {
    try {
      const { ts, sig } = await signed("pass-revoke");
      await api.revokePass(a.ensName, ts, sig);
      setPhase({ t: "idle" });
      onChange();
    } catch (e) {
      setPhase({ t: "error", message: (e as Error).message });
    }
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="card card-hover relative overflow-hidden p-5">
      <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${ok ? "var(--color-accent)" : "var(--color-danger)"}, transparent)` }} />
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center border border-line-strong bg-surface-2 ${ok ? "text-accent" : "text-danger"}`}>
            <Bot className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-[16px] font-semibold">{a.ensName}</p>
            <ExplorerLink k={{ type: "hedera-account", id: a.hederaAccount }} />
          </div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 border px-2.5 py-1 font-label text-[12px] ${ok ? "border-accent/30 bg-accent/10 text-accent" : "border-danger/30 bg-danger/10 text-danger"}`}>
          {ok ? <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> : <ShieldAlert className="h-3.5 w-3.5" aria-hidden />}
          {ok ? left(a.pass.expiresAt) : a.pass.reason === "expired" ? "Pass expired" : "No pass"}
        </span>
      </div>

      <p className="mt-4 text-[13px] text-muted">{a.pass.message}</p>
      {(a.erc8004 || a.uaid) && (
        <dl className="mt-3 space-y-1 border-t border-line pt-3 text-[12px] text-muted">
          {a.erc8004 && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <dt>ERC-8004</dt>
              <dd className="num">
                <a className="link" target="_blank" rel="noreferrer" href={`https://sepolia.etherscan.io/token/${a.erc8004.split(":")[2]}?a=${a.erc8004.split(":")[3]}`}>
                  agent #{a.erc8004.split(":")[3]}
                </a>
              </dd>
            </div>
          )}
          {a.uaid && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <dt>HCS-14 UAID</dt>
              <dd className="num truncate" title={a.uaid}>{a.uaid.split(";")[0].slice(0, 22)}…</dd>
            </div>
          )}
        </dl>
      )}

      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-[12px] text-muted">
          <span>Budget on ENS</span>
          <span className="num">{usd(a.spentUsd)} / {usd(a.budgetUsd)}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
          <motion.div className="h-full rounded-full bg-accent" initial={false} animate={{ width: `${used * 100}%` }} transition={{ duration: 0.5 }} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {phase.t === "waiting" && (
          <motion.div key="w" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-4 overflow-hidden border border-accent/30 bg-accent/5 p-4">
            <p className="text-[13px] text-muted">Approve this agent in World. The gateway validates the result.</p>
            <p className="num mt-2 text-[22px] tracking-[0.2em]">{phase.start.userCode}</p>
            <a href={phase.start.verificationUriComplete ?? phase.start.verificationUri} target="_blank" rel="noreferrer" className="link mt-2 inline-flex items-center gap-1.5 text-[13px] text-accent">
              Open World <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
            <p className="mt-2 flex items-center gap-2 text-[12px] text-faint"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Waiting for approval</p>
          </motion.div>
        )}
        {phase.t === "done" && (
          <motion.p key="d" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-[13px] text-accent">
            Pass written to ENS <ExplorerLink k={{ type: "evm-tx", chainId: 11155111, id: phase.tx }} />
          </motion.p>
        )}
        {phase.t === "error" && (
          <motion.p key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">{phase.message}</motion.p>
        )}
      </AnimatePresence>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-4">
        <p className="min-w-0 truncate text-[12.5px] text-faint">{a.last ? `${a.last.kind} · ${ago(a.last.ts)}` : "No activity"}</p>
        <div className="flex gap-2">
          {a.pass.valid && (
            <button className="btn btn-ghost !min-h-9 !px-3 !text-[13px]" onClick={revoke}>Revoke</button>
          )}
          <button className="btn btn-ghost !min-h-9 !px-3 !text-[13px]" disabled={phase.t === "signing" || phase.t === "waiting"} onClick={renew}>
            {phase.t === "signing" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            {a.pass.valid ? "Renew pass" : "Get pass"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
