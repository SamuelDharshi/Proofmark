"use client";
import { useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { api } from "@/lib/api";
import { usePoll } from "@/lib/usePoll";
import { AgentCard } from "./AgentCard";
import { EventFeed, PaymentTable } from "./Feed";
import { Drill } from "./Drill";

const TABS = [
  { id: "agents", label: "Agents" },
  { id: "activity", label: "Activity" },
  { id: "payments", label: "Payments" },
  { id: "drill", label: "Drill" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const Stat = ({ k, v }: { k: string; v: string | number }) => (
  <div className="card px-5 py-4">
    <p className="label">{k}</p>
    <p className="num mt-1 text-[26px] font-medium">{v}</p>
  </div>
);

export function FleetView() {
  const { data, error, refresh } = usePoll(api.fleet, 3000);
  const [tab, setTab] = useState<Tab>("agents");

  return (
    <div className="mx-auto max-w-[1100px]">
      <p className="font-pixel text-[13px] tracking-widest text-accent">FLEET</p>
      <h1 className="mt-2 font-hero font-medium tracking-[-0.03em] text-[clamp(38px,4.6vw,60px)] leading-none">Every agent, one view.</h1>

      {error && !data ? (
        <div className="card mt-8 p-10 text-center text-muted">Gateway unreachable. Run <span className="num">npm run gateway</span>.</div>
      ) : !data ? (
        <div className="mt-8 h-40 animate-pulse bg-surface" />
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat k="Agents" v={data.agents.length} />
            <Stat k="Payments" v={data.payments.length} />
            <Stat k="Claimed servers" v={data.claims.length} />
            <Stat k="Revoked keys" v={data.keys.filter((k) => !k.live).length} />
          </div>

          <LayoutGroup id="fleet-tabs">
            <div role="tablist" className="mt-8 flex gap-1 border-b border-line">
              {TABS.map((t) => (
                <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`relative min-h-11 px-4 font-label text-[14px] transition-colors ${tab === t.id ? "text-text" : "text-muted hover:text-text"}`}>
                  {t.label}
                  {tab === t.id && <motion.span layoutId="fleet-underline" className="absolute inset-x-2 -bottom-px h-0.5 bg-accent" />}
                </button>
              ))}
            </div>
          </LayoutGroup>

          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="mt-6">
              {tab === "agents" &&
                (data.agents.length ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {data.agents.map((a) => (
                      <AgentCard key={a.ensName} a={a} onChange={refresh} />
                    ))}
                  </div>
                ) : (
                  <div className="card p-10 text-center text-muted">No agents registered. Run <span className="num">npm run agents:create -w @proofmark/gateway</span>. Each agent becomes an ENS name.</div>
                ))}
              {tab === "activity" && <EventFeed events={data.events} />}
              {tab === "payments" && <PaymentTable payments={data.payments} />}
              {tab === "drill" && <Drill fleet={data} onChange={refresh} />}
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
