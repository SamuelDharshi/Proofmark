"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, Check, Fingerprint, Loader2, Server, Users, Building2, AlertCircle } from "lucide-react";
import { IDKitRequestWidget, proofOfHuman, type RpContext } from "@worldcoin/idkit";
import { ApiError, api } from "@/lib/api";
import { useWallet } from "@/lib/useWallet";
import { ExplorerLink } from "../ExplorerLink";
import { Maintainers } from "./Maintainers";

const STEPS = [
  { id: 1, label: "Server", Icon: Server },
  { id: 2, label: "Human", Icon: Fingerprint },
  { id: 3, label: "Organisation", Icon: Building2 },
  { id: 4, label: "Co-maintainers", Icon: Users },
] as const;

const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <label className="block">
    <span className="mb-1.5 block text-[13px] text-muted">{label}</span>
    {children}
    {hint && <span className="mt-1.5 block text-[12px] text-faint">{hint}</span>}
  </label>
);
const input = "num h-11 w-full rounded-xl border border-line bg-bg px-3.5 text-[14px] outline-none transition-colors placeholder:text-faint focus:border-accent/60";

type Own = Awaited<ReturnType<typeof api.ownership>>;
type World = { rp_context: RpContext; app_id: `app_${string}`; action: string; environment: "staging" | "production" };

export function ClaimWizard() {
  const wallet = useWallet();
  const [step, setStep] = useState(1);
  const [server, setServer] = useState("");
  const [own, setOwn] = useState<Own | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [world, setWorld] = useState<World | null>(null);
  const [open, setOpen] = useState(false);
  const [proof, setProof] = useState<unknown>(null);

  const [org, setOrg] = useState("");
  const [payTo, setPayTo] = useState("");
  const [price, setPrice] = useState("0.002");
  const [claimed, setClaimed] = useState<any>(null);

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof ApiError ? (e.body?.message ?? e.body?.error ?? e.message) : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verifyOwnership = () =>
    guard(async () => {
      const r = await api.ownership(server.trim());
      setOwn(r);
      if (r.ok) setStep(2);
    });

  const startWorld = () =>
    guard(async () => {
      const s = await api.rpSignature();
      setWorld({
        rp_context: { rp_id: s.rp_id, nonce: s.nonce, created_at: s.created_at, expires_at: s.expires_at, signature: s.sig },
        app_id: s.app_id,
        action: s.action,
        environment: s.environment,
      });
      setOpen(true);
    });

  const submitClaim = () =>
    guard(async () => {
      const r = await api.claim({ server: server.trim(), org, owner: wallet.address, payTo, price: Number(price), idkitResponse: proof });
      setClaimed(r);
      setStep(4);
    });

  return (
    <div className="mx-auto max-w-[760px]">
      <p className="font-pixel text-[13px] tracking-widest text-accent">CLAIM</p>
      <h1 className="mt-2 font-hero text-[clamp(38px,4.6vw,60px)] leading-none">Claim your server.</h1>

      <ol className="mt-8 grid grid-cols-4 gap-2" aria-label="Progress">
        {STEPS.map(({ id, label, Icon }) => {
          const done = step > id || (id === 4 && claimed);
          const active = step === id;
          return (
            <li key={id} className={`rounded-xl border px-3 py-3 transition-colors ${active ? "border-accent/50 bg-accent/5" : "border-line bg-surface"}`}>
              <span className={`grid h-7 w-7 place-items-center rounded-lg ${done ? "bg-accent text-accent-ink" : active ? "bg-surface-2 text-accent" : "bg-surface-2 text-faint"}`}>
                {done ? <Check className="h-4 w-4" aria-hidden /> : <Icon className="h-4 w-4" aria-hidden />}
              </span>
              <p className={`mt-2 hidden font-label text-[13px] sm:block ${active ? "text-text" : "text-muted"}`}>{label}</p>
            </li>
          );
        })}
      </ol>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} className="card mt-6 p-6">
          {step === 1 && (
            <div className="space-y-5">
              <Field label="Registry name" hint="The name exactly as the official MCP registry lists it.">
                <input className={input} value={server} onChange={(e) => setServer(e.target.value)} placeholder="io.github.acme/filesystem" />
              </Field>
              {own && (
                <p className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-[14px] ${own.ok ? "border-accent/30 bg-accent/10 text-accent" : "border-danger/30 bg-danger/10 text-danger"}`}>
                  {own.ok ? <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
                  <span>{own.detail} <span className="opacity-70">({own.method})</span></span>
                </p>
              )}
              <button className="btn btn-primary" disabled={!server.trim() || busy} onClick={verifyOwnership}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Verify ownership
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <p className="text-[15px] text-muted">One claim per human. World ID Proof of Human is verified on the gateway, never on this page.</p>
              {proof ? (
                <p className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-[14px] text-accent">
                  <BadgeCheck className="h-4 w-4" aria-hidden /> Proof collected. It is checked when you claim.
                </p>
              ) : (
                <button className="btn btn-primary" disabled={busy} onClick={startWorld}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Verify with World ID
                </button>
              )}
              {world && (
                <IDKitRequestWidget
                  open={open}
                  onOpenChange={setOpen}
                  app_id={world.app_id}
                  action={world.action}
                  rp_context={world.rp_context}
                  allow_legacy_proofs={true}
                  environment={world.environment}
                  preset={proofOfHuman({ signal: wallet.address ?? undefined })}
                  handleVerify={async (result) => setProof(result)}
                  onSuccess={() => setStep(3)}
                />
              )}
              {proof !== null && <button className="btn btn-ghost" onClick={() => setStep(3)}>Continue</button>}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <Field label="Organisation name" hint="Becomes <name>.thanks.eth on ENS. Letters, numbers and dashes.">
                <input className={input} value={org} onChange={(e) => setOrg(e.target.value.toLowerCase())} placeholder="acme" />
              </Field>
              <Field label="Owner wallet" hint="Owns the ENS name and approves co-maintainers.">
                {wallet.address ? <p className="num flex h-11 items-center rounded-xl border border-line bg-bg px-3.5 text-[14px]">{wallet.address}</p> : <button className="btn btn-ghost" onClick={wallet.connect}>Connect wallet</button>}
                {wallet.error && <span className="mt-1.5 block text-[12px] text-danger">{wallet.error}</span>}
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Hedera account for payouts" hint="Receives each $0.002 connect fee.">
                  <input className={input} value={payTo} onChange={(e) => setPayTo(e.target.value)} placeholder="0.0.123456" />
                </Field>
                <Field label="Price per connect (USD)" hint="The gateway caps this at $0.05.">
                  <input className={input} value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
                </Field>
              </div>
              <button className="btn btn-primary" disabled={busy || !org || !wallet.address || !payTo || !proof} onClick={submitClaim}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Claim {server.split("/").pop() || "server"}
              </button>
            </div>
          )}

          {step === 4 && claimed && (
            <div className="space-y-5">
              <p className="flex items-center gap-2 text-[16px] text-accent"><BadgeCheck className="h-5 w-5" aria-hidden /> Claimed by {claimed.org.ensName}</p>
              {claimed.org.ensTx && <p className="text-[14px] text-muted">ENS registration <ExplorerLink k={{ type: "evm-tx", chainId: 11155111, id: claimed.org.ensTx }} /></p>}
              <Maintainers server={server.trim()} org={claimed.org.name} />
            </div>
          )}

          {err && (
            <p className="mt-5 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-[14px] text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {err}
            </p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
