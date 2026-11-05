"use client";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, BadgeCheck, Ban, Box, CircleDollarSign, KeyRound, ScrollText, ShieldCheck, Users } from "lucide-react";
import { ExplorerLink } from "../ExplorerLink";
import { ago, usd } from "@/lib/format";
import type { EventRow, Payment } from "@/lib/api";

const ICON: Record<string, { Icon: typeof Box; cls: string }> = {
  payment: { Icon: CircleDollarSign, cls: "text-accent" },
  attest: { Icon: ShieldCheck, cls: "text-accent" },
  attestation: { Icon: ScrollText, cls: "text-accent" },
  claim: { Icon: BadgeCheck, cls: "text-accent" },
  ens: { Icon: KeyRound, cls: "text-sandbox" },
  comaintainer: { Icon: Users, cls: "text-sandbox" },
  sandboxed: { Icon: Box, cls: "text-sandbox" },
  denied: { Icon: Ban, cls: "text-danger" },
  blocked: { Icon: Ban, cls: "text-danger" },
  revoked: { Icon: AlertTriangle, cls: "text-danger" },
  "claim-rejected": { Icon: Ban, cls: "text-danger" },
};

export function EventFeed({ events }: { events: EventRow[] }) {
  if (!events.length) return <div className="card p-10 text-center text-muted">No activity yet. Connect an agent to see events here.</div>;
  return (
    <ul className="card divide-y divide-line overflow-hidden">
      <AnimatePresence initial={false}>
        {events.map((e) => {
          const { Icon, cls } = ICON[e.kind] ?? { Icon: Box, cls: "text-muted" };
          return (
            <motion.li key={e.id} layout initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }} className="flex items-start gap-3 px-5 py-3.5">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cls}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[14px]">{e.detail}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12px] text-faint">
                  <span className="font-label uppercase tracking-wider">{e.kind}</span>
                  {e.server && <span className="num">{e.server}</span>}
                  <span>{ago(e.ts)}</span>
                </p>
              </div>
              {e.tx && <ExplorerLink k={e.tx.chain === "hedera" ? { type: "hedera-tx", id: e.tx.id } : { type: "evm-tx", chainId: 11155111, id: e.tx.id }} />}
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}

export function PaymentTable({ payments }: { payments: Payment[] }) {
  if (!payments.length) return <div className="card p-10 text-center text-muted">No settled payments yet.</div>;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-[14px]">
        <thead className="border-b border-line text-[12px] text-muted">
          <tr>
            <th className="px-5 py-3 font-medium">Server</th>
            <th className="px-3 py-3 font-medium">Amount</th>
            <th className="px-3 py-3 font-medium">Settlement</th>
            <th className="px-3 py-3 font-medium">HCS anchor</th>
            <th className="px-5 py-3 text-right font-medium">When</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {payments.map((p) => (
            <tr key={p.id}>
              <td className="num max-w-[260px] truncate px-5 py-3">{p.server}</td>
              <td className="num px-3 py-3">{usd(p.usd)}</td>
              <td className="px-3 py-3"><ExplorerLink k={{ type: "hedera-tx", id: p.txId }} /></td>
              <td className="px-3 py-3">{p.hcs ? <ExplorerLink k={{ type: "hedera-tx", id: p.hcs.tx }} label={`#${p.hcs.sequence}`} /> : <span className="text-faint">n/a</span>}</td>
              <td className="px-5 py-3 text-right text-muted">{ago(p.ts)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
