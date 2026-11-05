"use client";
import { motion } from "framer-motion";
import { FileClock } from "lucide-react";
import { api } from "@/lib/api";
import { usePoll } from "@/lib/usePoll";
import { ExplorerLink } from "../ExplorerLink";
import { short } from "@/lib/format";

/** The public replayable log, read straight from the Hedera mirror node. */
export function LogView() {
  const { data, error } = usePoll(api.hcs, 5000);
  return (
    <div className="mx-auto max-w-[900px]">
      <p className="font-pixel text-[13px] tracking-widest text-accent">HCS LOG</p>
      <h1 className="mt-2 font-hero text-[clamp(38px,4.6vw,60px)] leading-none">Every attestation, on the record.</h1>
      {data?.topic && (
        <p className="mt-4 flex items-center gap-2 text-[14px] text-muted">
          Topic <ExplorerLink k={{ type: "hedera-topic", id: data.topic }} />
        </p>
      )}

      <div className="mt-8">
        {error && !data ? (
          <div className="card p-10 text-center text-muted">Gateway unreachable.</div>
        ) : !data ? (
          <div className="h-40 animate-pulse rounded-[var(--radius-card)] bg-surface" />
        ) : !data.topic ? (
          <div className="card p-10 text-center text-muted">No HCS topic configured. Run <span className="num">npm run hcs:create -w @proofmark/gateway</span> and set <span className="num">HCS_TOPIC_ID</span>.</div>
        ) : data.messages.length === 0 ? (
          <div className="card p-10 text-center text-muted">No messages yet.</div>
        ) : (
          <ul className="space-y-3">
            {data.messages.map((m, i) => (
              <motion.li key={m.sequence} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }} className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="flex items-center gap-2 font-label text-[12px] uppercase tracking-wider text-accent"><FileClock className="h-4 w-4" aria-hidden /> {m.body?.type ?? "message"}</span>
                  <span className="num text-[12px] text-faint">#{m.sequence}</span>
                </div>
                <p className="num mt-3 break-all text-[13px]">{m.body?.server}{m.body?.version ? ` @ ${m.body.version}` : ""}</p>
                <dl className="mt-3 grid gap-x-6 gap-y-1 text-[12.5px] text-muted sm:grid-cols-2">
                  {m.body?.artifactHash && <div><dt className="inline">artefact </dt><dd className="num inline text-text">{short(m.body.artifactHash, 10, 6)}</dd></div>}
                  {m.body?.toolManifestHash && <div><dt className="inline">manifest </dt><dd className="num inline text-text">{short(m.body.toolManifestHash, 10, 6)}</dd></div>}
                  {m.body?.txId && <div className="sm:col-span-2"><dt className="inline">settlement </dt><dd className="inline"><ExplorerLink k={{ type: "hedera-tx", id: m.body.txId }} /></dd></div>}
                </dl>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
