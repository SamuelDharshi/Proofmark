"use client";
import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, CircleDashed, Loader2, ShieldX } from "lucide-react";
import type { CheckResult } from "@proofmark/core";
import { ApiError, api } from "@/lib/api";
import { useWallet } from "@/lib/useWallet";
import { ExplorerLink } from "../ExplorerLink";

type Row = { label: string; state: "ok" | "missing" | "bad"; detail: React.ReactNode };

/** The three layers behind a claim, one line each. Read-only, used on the claim page and the server page. */
export function LayerRows({ c }: { c: Pick<CheckResult, "worldVerified" | "domainVerified" | "bond" | "bondTx"> }) {
  const rows: Row[] = [
    { label: "Unique claim (World)", state: c.worldVerified ? "ok" : "missing", detail: c.worldVerified ? "One World identity, one claim. Limits sockpuppets." : "No World nullifier recorded" },
    { label: "Namespace", state: c.domainVerified ? "ok" : "missing", detail: c.domainVerified ?? "The GitHub account or domain behind the name is not proven yet" },
    {
      label: "Bond (Hedera)",
      state: c.bond === "live" ? "ok" : c.bond === "forfeited" ? "bad" : "missing",
      detail: c.bond === "live" && c.bondTx ? <ExplorerLink k={{ type: "hedera-tx", id: c.bondTx }} /> : c.bond === "forfeited" ? "Forfeited after a malicious release" : "No live bond",
    },
  ];
  return (
    <ul className="divide-y divide-line border border-line">
      {rows.map((r) => (
        <li key={r.label} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[14px]">
          <span className="flex items-center gap-2">
            {r.state === "ok" ? <BadgeCheck className="h-4 w-4 text-accent" aria-hidden /> : r.state === "bad" ? <ShieldX className="h-4 w-4 text-danger" aria-hidden /> : <CircleDashed className="h-4 w-4 text-faint" aria-hidden />}
            {r.label}
          </span>
          <span className={`num text-[13px] ${r.state === "bad" ? "text-danger" : "text-muted"}`}>{r.detail}</span>
        </li>
      ))}
    </ul>
  );
}

/** Claim step 4: the layer status for this server, and the bond deposit the owner records with one signature. */
export function Layers({ server, org }: { server: string; org: string }) {
  const wallet = useWallet();
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [bond, setBond] = useState<{ account: string | null; minHbar: number } | null>(null);
  const [tx, setTx] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    api.check(server).then(setCheck).catch(() => {});
  }, [server]);
  useEffect(() => {
    load();
    api.config().then((c) => setBond((c as any).bond ?? null)).catch(() => {});
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  const record = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const ownerSig = await wallet.sign(`proofmark:bond:${org}:${tx.trim()}`);
      const r = await api.postBond({ org, txId: tx.trim(), ownerSig });
      setMsg(`Bond recorded: ${r.hbar} HBAR.`);
      load();
    } catch (e) {
      setMsg(e instanceof ApiError ? (e.body?.message ?? e.body?.error ?? e.message) : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="font-display text-[16px] font-semibold">Layers</p>
      {check ? <LayerRows c={check} /> : <div className="h-28 animate-pulse bg-surface-2" />}
      {check && check.bond !== "live" && bond?.account && (
        <div className="space-y-3 border border-line bg-bg p-4 text-[14px]">
          <p className="text-muted">
            A server is green only with a live bond. Send at least <strong className="text-text">{bond.minHbar} HBAR</strong> from your payout account to{" "}
            <ExplorerLink k={{ type: "hedera-account", id: bond.account }} />, then paste the transaction id. The bond sits in a two-key account and the gateway marks it forfeited after a malicious release. It is not an automatic contract yet.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input value={tx} onChange={(e) => setTx(e.target.value)} placeholder="0.0.8150748@1793995806.183190447" aria-label="Bond transaction id" className="num h-11 w-full border border-line bg-bg px-3.5 text-[14px] outline-none placeholder:text-faint focus:border-accent/60" />
            <button className="btn btn-primary" disabled={!tx.trim() || busy || !wallet.address} onClick={record}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Record with owner signature
            </button>
          </div>
          {!wallet.address && <span className="self-center text-[13px] text-muted">Connect your wallet, top right.</span>}
          {msg && <p className="text-[13px] text-muted">{msg}</p>}
        </div>
      )}
    </div>
  );
}
