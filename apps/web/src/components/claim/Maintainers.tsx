"use client";
import { useState } from "react";
import { Loader2, ShieldCheck, UserPlus } from "lucide-react";
import { ApiError, WORKER, api } from "@/lib/api";
import { useWallet } from "@/lib/useWallet";
import { ExplorerLink } from "../ExplorerLink";

const input = "num h-11 w-full border border-line bg-bg px-3.5 text-[14px] outline-none transition-colors placeholder:text-faint focus:border-accent/60";

/** Co-maintainer subnames with their own expiring key, and the attestation run. */
export function Maintainers({ server, org }: { server: string; org: string }) {
  const wallet = useWallet();
  const [label, setLabel] = useState("");
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

  const addrOk = /^0x[0-9a-fA-F]{40}$/.test(addr.trim());
  const add = () =>
    run("add", async () => {
      if (!addrOk) throw new Error("The key address must be a wallet address, 0x followed by 40 characters. Not a transaction id.");
      const expiresAt = Math.floor(Date.now() / 1000) + Number(days) * 86400;
      const ownerSig = await wallet.sign(`proofmark:add-comaintainer:${org}:${label}:${addr}:${expiresAt}`);
      const r = await api.addCoMaintainer({ org, label, address: addr, expiresAt, ownerSig });
      setKeys((k) => [...k, { subname: r.key.subname, label: r.key.label, tx: r.key.ensTx }]);
    });

  // The hosted gateway cannot run containers. A small local worker derives the manifest in a sandbox, the wallet
  // signs it here, and the gateway re-checks everything before recording it.
  const attest = (l: string) =>
    run("att" + l, async () => {
      setMsg("Deriving the tool manifest in a sandbox…");
      let d: { pair: unknown; message: string; tools: unknown; signer: string; error?: string };
      try {
        const res = await fetch(`${WORKER}/derive`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ server, org, label: l }) });
        d = await res.json();
        if (!res.ok) throw new Error(d.error ?? `worker returned ${res.status}`);
      } catch (e) {
        const m = (e as Error).message;
        throw new Error(/Failed to fetch|NetworkError|Load failed/i.test(m) ? "The local worker is not running. In a terminal on your computer run: npm run worker -w @proofmark/gateway" : m);
      }
      if (wallet.address?.toLowerCase() !== d.signer.toLowerCase())
        throw new Error(`${l} signs with key ${d.signer.slice(0, 8)}…${d.signer.slice(-4)}, and the connected wallet is ${wallet.address?.slice(0, 8) ?? "none"}…. Only that key can sign this attestation. Switch to it in MetaMask, or add a co-maintainer whose key is your wallet.`);
      setMsg(`Sign with ${d.signer.slice(0, 8)}… in your wallet.`);
      const signature = await wallet.sign(d.message);
      const r = await api.submitAttest({ pair: d.pair, signature, tools: d.tools });
      setMsg(`Attested ${r.attestation.pair.version}. Manifest ${r.attestation.pair.toolManifestHash.slice(0, 14)}… recorded on HCS.`);
    });
  const [existing, setExisting] = useState("");

  const approve = () =>
    run("approve", async () => {
      const signature = await wallet.sign(pending!.message);
      const r = await api.approveAttest({ id: pending!.id, signature });
      setMsg(`Approved ${r.attestation.pair.version}.`);
      setPending(null);
    });

  return (
    <div className="space-y-6">
      <div className="space-y-4 border border-line bg-bg p-4">
        <p className="flex items-center gap-2 font-display text-[16px] font-semibold"><UserPlus className="h-4 w-4 text-accent" aria-hidden /> Add a co-maintainer</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr_110px]">
          <input className={input} value={label} onChange={(e) => setLabel(e.target.value.toLowerCase())} aria-label="Subname" placeholder="name, e.g. alice" />
          <input className={input} value={addr} onChange={(e) => setAddr(e.target.value)} aria-label="Key address" placeholder="0x… wallet address of the co-maintainer" />
          {addr && !addrOk && <p className="text-[12px] text-danger sm:col-span-3">That is not a wallet address. It must start with 0x and have 40 characters after it.</p>}
          <input className={input} value={days} onChange={(e) => setDays(e.target.value)} aria-label="Days until expiry" inputMode="numeric" />
        </div>
        {wallet.address ? (
          <button className="btn btn-primary" disabled={!label || !addr || busy === "add"} onClick={add}>
            {busy === "add" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Add with owner signature
          </button>
        ) : (
          <p className="text-[13px] text-muted">Connect the owner wallet with the button at the top right.</p>
        )}
      </div>

      {keys.length > 0 && (
        <ul className="divide-y divide-line border border-line">
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

      <div className="space-y-3 border border-line bg-bg p-4">
        <p className="flex items-center gap-2 font-display text-[16px] font-semibold"><ShieldCheck className="h-4 w-4 text-accent" aria-hidden /> Attest with an existing co-maintainer</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input className={input} value={existing} onChange={(e) => setExisting(e.target.value.toLowerCase())} aria-label="Co-maintainer subname" placeholder="main" />
          <button className="btn btn-primary" disabled={!existing || !!busy || !wallet.address} onClick={() => attest(existing)}>
            {busy === "att" + existing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Derive, sign and publish
          </button>
        </div>
        {!wallet.address && <p className="text-[13px] text-muted">Connect the owner wallet with the button at the top right.</p>}
      </div>

      {pending && (
        <div className="space-y-3 border border-accent/30 bg-accent/5 p-4">
          <p className="text-[14px]">The key <span className="num">{pending.signer}</span> must approve this attestation.</p>
          <button className="btn btn-primary" disabled={busy === "approve"} onClick={approve}>
            {busy === "approve" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Approve with that wallet
          </button>
        </div>
      )}
      {msg && <p className="border border-line bg-surface-2 px-4 py-3 text-[14px]">{msg}</p>}
    </div>
  );
}
