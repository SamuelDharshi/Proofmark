"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Radio } from "lucide-react";
import { api, type Config } from "@/lib/api";
import { HASHSCAN, HTS_COLLECTION, decodeMessage, mirror } from "@/lib/mirror";

/**
 * Everything Proofmark does on Hedera, read straight from the public mirror node, not from the gateway.
 * Each row links to HashScan, and new rows are also printed to the browser console.
 */
const HTS_DEFAULT = HTS_COLLECTION;
const PAYING_AGENT = "0.0.11331191";
const PAYOUT = "0.0.8150748";

type Row = { key: string; ts: number; kind: string; what: string; detail: string; href: string; ok: boolean };

const tsOf = (s: string) => Math.round(Number(s) * 1000);
const txUrl = (consensus: string) => `${HASHSCAN}/transaction/${consensus}`;
const decode = decodeMessage;
const get = mirror;

const TX_NAMES: Record<string, string> = {
  CRYPTOTRANSFER: "HBAR transfer",
  CONSENSUSSUBMITMESSAGE: "HCS message",
  TOKENMINT: "HTS mint",
  CRYPTOAPPROVEALLOWANCE: "Allowance approved",
  CRYPTODELETEALLOWANCE: "Allowance removed",
  CONSENSUSCREATETOPIC: "HCS topic created",
  TOKENCREATION: "HTS token created",
  CRYPTOCREATEACCOUNT: "Account created",
  TOKENASSOCIATE: "Token associated",
};

function describeMessage(topicName: string, b: any): string {
  if (!b) return "message";
  if (b.type === "revocation") return `Key ${b.subname ?? b.label} revoked (${b.reason ?? "no reason"})`;
  if (b.type === "bond") return `Bond ${b.hbar ?? ""} HBAR posted by ${b.org ?? "an org"} (${b.status ?? "live"})`;
  if (b.type === "payment" || (!b.type && b.txId)) return `Payment for ${b.server ?? "a server"}${b.usd ? `, $${b.usd}` : ""}`;
  if (b.type === "attestation") return `Attestation ${b.server ?? ""}${b.version ? ` @ ${b.version}` : ""}`;
  if (b.type) return `${b.type}${b.server ? ` ${b.server}` : b.agent ? ` ${b.agent}` : b.org ? ` ${b.org}` : ""}`;
  return topicName;
}

export function ChainConsole() {
  const [cfg, setCfg] = useState<(Config & { bond?: { account: string; minHbar: number }; revocations?: { topic: string } }) | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const seen = useRef(new Set<string>());

  useEffect(() => {
    api.config().then((c) => setCfg(c as any)).catch(() => setErr("Gateway unreachable, so the account list is unknown."));
  }, []);

  const ids = useMemo(() => {
    if (!cfg) return null;
    return {
      audit: cfg.hedera.topic,
      revoke: cfg.revocations?.topic ?? null,
      bond: cfg.bond?.account ?? null,
      gateway: cfg.hedera.gatewayAccount,
      hts: HTS_DEFAULT,
    };
  }, [cfg]);

  useEffect(() => {
    if (!ids) return;
    let stop = false;
    const load = async () => {
      try {
        const out: Row[] = [];
        const topics = [["Audit log", ids.audit], ["Revocations", ids.revoke]].filter(([, t]) => t) as [string, string][];
        const msgs = await Promise.all(topics.map(([, t]) => get(`/topics/${t}/messages?limit=40&order=desc`)));
        topics.forEach(([name, t], i) => {
          for (const m of msgs[i].messages ?? []) {
            const b = decode(m.message);
            out.push({ key: `m-${t}-${m.sequence_number}`, ts: tsOf(m.consensus_timestamp), kind: name === "Revocations" ? "revocation" : "hcs", what: `HCS ${name} #${m.sequence_number}`, detail: describeMessage(name, b), href: txUrl(m.consensus_timestamp), ok: true });
          }
        });

        const accounts = [ids.gateway, PAYOUT, PAYING_AGENT, ids.bond].filter(Boolean) as string[];
        const txs = await Promise.all(accounts.map((a) => get(`/transactions?account.id=${a}&limit=40&order=desc`)));
        const dedupe = new Set<string>();
        txs.forEach((t) => {
          for (const x of t.transactions ?? []) {
            if (dedupe.has(x.transaction_id) || x.name === "CONSENSUSSUBMITMESSAGE") continue;
            dedupe.add(x.transaction_id);
            const moved = (x.transfers ?? []).filter((tr: any) => accounts.includes(tr.account) && tr.amount !== 0).map((tr: any) => `${tr.account} ${tr.amount > 0 ? "+" : ""}${(tr.amount / 1e8).toFixed(4)} ℏ`).join(", ");
            const kind = x.name === "TOKENMINT" ? "hts" : x.name.includes("ALLOWANCE") ? "allowance" : x.name === "CRYPTOTRANSFER" ? "payment" : "other";
            out.push({ key: `t-${x.transaction_id}`, ts: tsOf(x.consensus_timestamp), kind, what: TX_NAMES[x.name] ?? x.name, detail: `${x.transaction_id}${moved ? ` · ${moved}` : ""}`, href: txUrl(x.consensus_timestamp), ok: x.result === "SUCCESS" });
          }
        });

        const [nfts, bond] = await Promise.all([
          get(`/tokens/${ids.hts}/nfts?limit=100`).catch(() => ({ nfts: [] })),
          ids.bond ? get(`/accounts/${ids.bond}`).catch(() => null) : null,
        ]);
        out.sort((a, b) => b.ts - a.ts);
        if (stop) return;

        for (const r of [...out].reverse()) {
          if (seen.current.has(r.key)) continue;
          seen.current.add(r.key);
          console.info(`%c[proofmark · hedera]%c ${r.what} — ${r.detail}\n${r.href}`, "color:#0a8a50;font-weight:bold", "color:inherit");
        }
        setRows(out);
        setStats({
          audit: String(msgs[0]?.messages?.[0]?.sequence_number ?? 0),
          revoke: String(msgs[1]?.messages?.[0]?.sequence_number ?? 0),
          nfts: String(nfts.nfts?.length ?? 0),
          bond: bond ? `${(bond.balance.balance / 1e8).toFixed(2)} ℏ` : "-",
        });
        setErr(null);
      } catch (e) {
        if (!stop) setErr((e as Error).message);
      }
    };
    load();
    const t = setInterval(load, 8000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [ids]);

  const shown = rows.filter((r) => filter === "all" || r.kind === filter);
  const FILTERS = [["all", "All"], ["payment", "Payments"], ["hcs", "HCS audit"], ["revocation", "Revocations"], ["hts", "HTS mints"], ["allowance", "Allowances"]];

  return (
    <div className="mx-auto max-w-[1000px]">
      <p className="font-pixel text-[13px] tracking-widest text-accent">ON-CHAIN</p>
      <h1 className="mt-2 font-hero text-[clamp(38px,4.6vw,60px)] font-medium leading-none tracking-[-0.03em]">Everything, on the record.</h1>
      <p className="mt-4 max-w-[620px] text-[15px] text-muted">
        Read live from the Hedera mirror node, not from our server. Every row opens on HashScan, and new rows are also printed to your browser console (F12).
      </p>

      {ids && (
        <div className="mt-8 grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["HCS audit topic", ids.audit, `${stats.audit ?? "…"} message${stats.audit === "1" ? "" : "s"}`, `${HASHSCAN}/topic/${ids.audit}`],
            ["HCS revocation topic", ids.revoke, `${stats.revoke ?? "…"} message${stats.revoke === "1" ? "" : "s"}`, `${HASHSCAN}/topic/${ids.revoke}`],
            ["HTS certificates (PMARK)", ids.hts, `${stats.nfts ?? "…"} minted`, `${HASHSCAN}/token/${ids.hts}`],
            ["Bond account, 2-of-2 keys", ids.bond, stats.bond ?? "…", `${HASHSCAN}/account/${ids.bond}`],
          ].map(([label, id, value, href]) => (
            <a key={label} href={href ?? "#"} target="_blank" rel="noreferrer" className="group bg-surface p-5 transition-colors hover:bg-bg">
              <p className="label">{label}</p>
              <p className="mt-3 text-[26px] font-medium leading-none">{value}</p>
              <p className="num mt-2 inline-flex items-center gap-1 text-[12px] text-accent">{id ?? "not set"} <ExternalLink className="h-3 w-3" aria-hidden /></p>
            </a>
          ))}
        </div>
      )}

      {cfg && (
        <p className="mt-4 text-[13px] text-muted">
          Also on-chain: ENS names on Sepolia, written by{" "}
          <a className="link num text-accent" target="_blank" rel="noreferrer" href={`https://sepolia.etherscan.io/address/${cfg.ens.admin}`}>{cfg.ens.admin}</a>
          {" "}and the ERC-8004 registry{" "}
          <a className="link num text-accent" target="_blank" rel="noreferrer" href="https://sepolia.etherscan.io/address/0x8004A818BFB912233c491871b3d84c89A494BD9e">0x8004…BD9e</a>.
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <span className="mr-2 inline-flex items-center gap-2 text-[13px] text-muted"><Radio className="h-4 w-4 animate-pulse text-accent" aria-hidden /> live, every 8 s</span>
        {FILTERS.map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} className={`border px-3 py-1.5 font-label text-[12px] uppercase tracking-wider ${filter === id ? "border-text bg-text text-bg" : "border-line-strong text-muted hover:text-text"}`}>{label}</button>
        ))}
      </div>

      {err && <p className="mt-4 border border-danger/30 bg-danger/10 px-4 py-3 text-[14px] text-danger">{err}</p>}

      <div className="mt-4 border border-line bg-[#1e1e1e] font-mono text-[12.5px] text-[#d8d6d2]">
        {rows.length === 0 && !err ? (
          <p className="p-6 text-[#8a8683]">Reading the mirror node…</p>
        ) : (
          <ul className="max-h-[640px] divide-y divide-white/5 overflow-y-auto">
            {shown.map((r) => (
              <li key={r.key}>
                <a href={r.href} target="_blank" rel="noreferrer" className="grid gap-x-4 px-4 py-2.5 hover:bg-white/5 sm:grid-cols-[150px_170px_1fr]">
                  <span className="text-[#8a8683]">{new Date(r.ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                  <span className={r.ok ? "text-[#38f997]" : "text-[#ff6b6b]"}>{r.what}{r.ok ? "" : " (failed)"}</span>
                  <span className="break-all">{r.detail}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
