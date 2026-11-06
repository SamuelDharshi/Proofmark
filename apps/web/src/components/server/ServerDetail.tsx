"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { ArrowLeft, BadgeCheck, Hash, KeyRound, Layers, Plug, Wrench } from "lucide-react";
import type { CheckResult, ServerInfo } from "@proofmark/core";
import { ServerFacts } from "./ServerFacts";
import { api, GATEWAY } from "@/lib/api";
import { usd } from "@/lib/format";
import { TierBadge, tierColor } from "../TierBadge";
import { ExplorerLink } from "../ExplorerLink";
import { CopyText } from "../CopyText";

type Detail = CheckResult & { keySource: string | null; divergent?: number; info?: ServerInfo };
const TABS = [
  { id: "overview", label: "Overview", Icon: Layers },
  { id: "tools", label: "Tools", Icon: Wrench },
  { id: "hashes", label: "Hashes", Icon: Hash },
  { id: "connect", label: "Connect", Icon: Plug },
] as const;
type Tab = (typeof TABS)[number]["id"];

const Row = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3.5 last:border-0">
    <dt className="text-[14px] text-muted">{k}</dt>
    <dd className="text-[14px]">{children}</dd>
  </div>
);

export function ServerDetail({ name }: { name: string }) {
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    let live = true;
    const load = () => api.check(name, true).then((r) => live && setD(r)).catch((e) => live && setErr(e.message));
    load();
    const t = setInterval(load, 8000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [name]);

  const color = d ? tierColor[d.tier] : "var(--color-line)";
  const snippet = JSON.stringify(
    {
      mcpServers: {
        [name.split("/").pop() ?? "server"]: {
          command: "npx",
          args: ["tsx", "apps/proxy/src/cli.ts", "--server", name, "--gateway", GATEWAY, "--artifact", "<path to the build>", "--", "<command that starts the server>"],
          env: { AGENT_HEDERA_ACCOUNT_ID: "0.0.xxxx", AGENT_HEDERA_PRIVATE_KEY: "<ECDSA key>", AGENT_ENS_NAME: "claude-1.team.eth" },
        },
      },
    },
    null,
    2,
  );

  return (
    <div className="wrap pb-10 pt-32">
      <Link href="/marketplace" className="link inline-flex items-center gap-2 text-[14px] text-muted hover:text-text">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Marketplace
      </Link>

      {err ? (
        <div className="card mt-8 p-10 text-center text-muted">Gateway unreachable. {err}</div>
      ) : !d ? (
        <div className="mt-8 h-40 animate-pulse bg-surface" />
      ) : (
        <>
          <header className="relative mt-8 overflow-hidden border border-line bg-surface p-7">
            <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
            <span aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-20 blur-3xl" style={{ background: color }} />
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="break-all font-hero font-medium tracking-[-0.03em] text-[clamp(34px,4.4vw,56px)] leading-[1.02]">{d.server.split("/").pop()}</h1>
                <p className="num mt-1 break-all text-[13px] text-faint">{d.server}</p>
              </div>
              <TierBadge tier={d.tier} className="!px-3.5 !py-1.5 !text-[13px]" />
            </div>
            <p className="relative mt-5 max-w-[640px] text-[16px] text-muted">{d.explain}</p>
          </header>

          <LayoutGroup id="server-tabs">
            <div role="tablist" className="mt-8 flex flex-wrap gap-1 border-b border-line">
              {TABS.map(({ id, label, Icon }) => (
                <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`relative flex min-h-11 items-center gap-2 px-4 font-label text-[14px] transition-colors ${tab === id ? "text-text" : "text-muted hover:text-text"}`}>
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                  {tab === id && <motion.span layoutId="detail-underline" className="absolute inset-x-2 -bottom-px h-0.5 bg-accent" />}
                </button>
              ))}
            </div>
          </LayoutGroup>

          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="mt-6">
              {tab === "overview" && (
                <div className="space-y-5">
                {d.info && <div className="card p-6"><ServerFacts info={d.info} claimed={d.claimed} /></div>}
                <dl className="card px-6">
                  <Row k="Maintainer">{d.org ? <ExplorerLink k={{ type: "ens", id: d.org }} /> : <span className="text-muted">Unclaimed</span>}</Row>
                  <Row k="Human verified">
                    {d.worldVerified ? (
                      <span className="inline-flex items-center gap-1.5 text-accent"><BadgeCheck className="h-4 w-4" aria-hidden /> One World ID</span>
                    ) : (
                      <span className="text-muted">No</span>
                    )}
                  </Row>
                  <Row k="Price per connect"><span className="num">{usd(d.price ?? 0.002)}</span></Row>
                  <Row k="Attested version"><span className="num">{d.version ?? "none"}</span></Row>
                  <Row k="Key state read from"><span className="num">{d.keySource ?? "n/a"}</span></Row>
                  <Row k="Clients reporting a different manifest"><span className="num">{d.divergent ?? 0}</span></Row>
                  <Row k="Attestation certificate">
                    {d.nftToken ? (
                      <a className="link num text-accent" target="_blank" rel="noreferrer" href={`https://hashscan.io/testnet/token/${d.nftToken}/${d.nftSerial}`}>
                        HTS NFT {d.nftToken} #{d.nftSerial}
                      </a>
                    ) : (
                      <span className="text-muted">None yet</span>
                    )}
                  </Row>
                  <Row k="HCS anchor">
                    {d.hcsTopic ? (
                      <span className="inline-flex items-center gap-2"><ExplorerLink k={{ type: "hedera-topic", id: d.hcsTopic }} /> <span className="num text-muted">#{d.hcsSequence}</span></span>
                    ) : (
                      <span className="text-muted">None yet</span>
                    )}
                  </Row>
                </dl>
                </div>
              )}

              {tab === "tools" &&
                (d.tools?.length ? (
                  <ul className="grid gap-3 md:grid-cols-2">
                    {d.tools.map((t) => (
                      <li key={t.name} className="card p-5">
                        <p className="num text-[14px] text-accent">{t.name}</p>
                        <p className="mt-2 text-[14px] text-muted">{t.description}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="card p-10 text-center text-muted">No attested tool manifest for this server.</div>
                ))}

              {tab === "hashes" && (
                <dl className="card px-6">
                  <Row k="Artefact hash">{d.artifactHash ? <CopyText value={d.artifactHash} display={d.artifactHash.slice(0, 18) + "…" + d.artifactHash.slice(-8)} /> : <span className="text-muted">none</span>}</Row>
                  <Row k="Tool-manifest hash">{d.toolManifestHash ? <CopyText value={d.toolManifestHash} display={d.toolManifestHash.slice(0, 18) + "…" + d.toolManifestHash.slice(-8)} /> : <span className="text-muted">none</span>}</Row>
                  <Row k="Attest key">
                    {d.attestKey ? <span className="inline-flex items-center gap-2"><KeyRound className="h-4 w-4 text-faint" aria-hidden /><ExplorerLink k={{ type: "evm-address", chainId: 11155111, id: d.attestKey }} /></span> : <span className="text-muted">none</span>}
                  </Row>
                </dl>
              )}

              {tab === "connect" && (
                <div className="card p-5">
                  <p className="text-[14px] text-muted">Point the agent client at Proofmark instead of the server. The proxy pays, verifies and then launches it.</p>
                  <pre className="num mt-4 overflow-x-auto border border-line bg-bg p-4 text-[12.5px] leading-relaxed">{snippet}</pre>
                  <div className="mt-3"><CopyText value={snippet} display="Copy config" /></div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
