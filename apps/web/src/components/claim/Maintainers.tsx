"use client";
import { useState } from "react";
import { Loader2, ShieldCheck, UserPlus } from "lucide-react";
import { ApiError, api } from "@/lib/api";
import { useWallet } from "@/lib/useWallet";
import { ExplorerLink } from "../ExplorerLink";

const input = "num h-11 w-full rounded-xl border border-line bg-bg px-3.5 text-[14px] outline-none transition-colors placeholder:text-faint focus:border-accent/60";

/** Co-maintainer subnames with their own expiring key, and the attestation run. */
export function Maintainers({ server, org }: { server: string; org: string }) {
  const wallet = useWallet();
  const [label, setLabel] = useState("alice");
  const [addr, setAddr] = useState("");
  const [days, setDays] = useState("180");
  const [keys, setKeys] = useState<{ subname: string; label: string; tx?: string }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: string; message: string; signer: string } | null>(null);

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg(e instanceof ApiError ? (e.body?.message ?? e.body?.error ?? e.message) : (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const add = () =>
    run("add", async () => {
      const expiresAt = Math.floor(Date.now() / 1000) + Number(days) * 86400;
      const ownerSig = await wallet.sign(`proofmark:add-comaintainer:${org}:${label}:${addr}:${expiresAt}`);
      const r = await api.addCoMaintainer({ org, label, address: addr, expiresAt, ownerSig });
      setKeys((k) => [...k, { subname: r.key.subname, label: r.key.label, tx: r.key.ensTx }]);
    });

  const attest = (l: string) =>
    run("att" + l, async () => {
      const r = await api.runAttest({ server, label: l });
      if (r.status === "attested") setMsg(`Attested ${r.attestation.pair.version}. Manifest ${r.attestation.pair.toolManifestHash.slice(0, 14)}…`);
      else setPending({ id: r.id, message: r.message, signer: r.signer });
    });

  const approve = () =>
    run("approve", async () => {
      const signature = await wallet.sign(pending!.message);
      const r = await api.approveAttest({ id: pending!.id, signature });
      setMsg(`Approved ${r.attestation.pair.version}.`);
      setPending(null);
    });

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-xl border border-line bg-bg p-4">
        <p className="flex items-center gap-2 font-display text-[16px] font-semibold"><UserPlus className="h-4 w-4 text-accent" aria-hidden /> Add a co-maintainer</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr_110px]">
          <input className={input} value={label} onChange={(e) => setLabel(e.target.value.toLowerCase())} aria-label="Subname" placeholder="alice" />
          <input className={input} value={addr} onChange={(e) => setAddr(e.target.value)} aria-label="Key address" placeholder="0x… attest key" />
          <input className={input} value={days} onChange={(e) => setDays(e.target.value)} aria-label="Days until expiry" inputMode="numeric" />
        </div>
        {wallet.address ? (
          <button className="btn btn-primary" disabled={!label || !addr || busy === "add"} onClick={add}>
            {busy === "add" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Add with owner signature
          </button>
        ) : (
          <button className="btn btn-ghost" onClick={wallet.connect}>Connect owner wallet</button>
        )}
      </div>

      {keys.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {keys.map((k) => (
            <li key={k.subname} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="flex flex-col"><ExplorerLink k={{ type: "ens", id: k.subname }} />{k.tx && <ExplorerLink k={{ type: "evm-tx", chainId: 11155111, id: k.tx }} className="mt-1" />}</span>
              <button className="btn btn-ghost !min-h-9 !px-3 !text-[13px]" disabled={!!busy} onClick={() => attest(k.label)}>
                {busy === "att" + k.label ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShieldCheck className="h-4 w-4" aria-hidden />} Attest latest
              </button>
            </li>
          ))}
        </ul>
      )}

      {pending && (
        <div className="space-y-3 rounded-xl border border-accent/30 bg-accent/5 p-4">
          <p className="text-[14px]">The key <span className="num">{pending.signer}</span> must approve this attestation.</p>
          <button className="btn btn-primary" disabled={busy === "approve"} onClick={approve}>
            {busy === "approve" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Approve with that wallet
          </button>
        </div>
      )}
      {msg && <p className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-[14px]">{msg}</p>}
    </div>
  );
}
