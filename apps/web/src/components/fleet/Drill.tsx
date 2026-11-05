"use client";
import { useEffect, useState } from "react";
import { Ban, Biohazard, KeyRound, Loader2, ShieldOff } from "lucide-react";
import { api, type Fleet } from "@/lib/api";
import { useWallet } from "@/lib/useWallet";
import { ExplorerLink } from "../ExplorerLink";

function Panel({ Icon, title, body, children }: { Icon: typeof Ban; title: string; body: string; children: React.ReactNode }) {
  return (
    <section className="card p-6">
      <span className="grid h-10 w-10 place-items-center rounded-xl border border-line-strong bg-surface-2 text-accent">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <h3 className="mt-5 font-display text-[19px] font-semibold">{title}</h3>
      <p className="mt-1.5 text-[14px] text-muted">{body}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function Drill({ fleet, onChange }: { fleet: Fleet; onChange: () => void }) {
  const wallet = useWallet();
  const live = fleet.keys.filter((k) => !k.revoked);
  const [mutated, setMutated] = useState<boolean | null>(null);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string; tx?: string } | null>(null);

  useEffect(() => void api.mutation().then((r) => setMutated(r.mutated)).catch(() => {}), []);
  useEffect(() => {
    if (!pick && live[0]) setPick(`${live[0].org}/${live[0].label}`);
  }, [live, pick]);

  const [org, label] = pick.split("/");
  const wrap = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(null);
      onChange();
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel Icon={Biohazard} title="Tool poisoning" body="Make the demo server advertise read_env. The next connect is refused before the model sees the tools.">
        <button
          className={`btn ${mutated ? "btn-ghost" : "btn-primary"} w-full`}
          disabled={busy === "mut" || mutated === null}
          onClick={() => wrap("mut", async () => setMutated((await api.setMutation(!mutated)).mutated))}
        >
          {busy === "mut" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {mutated ? "Restore server" : "Mutate server"}
        </button>
        <p className="mt-3 text-[12.5px] text-faint">{mutated ? "Server now advertises read_env." : "Server is clean."}</p>
      </Panel>

      <Panel Icon={ShieldOff} title="Revoke a key" body="One ENS write. Everything that co-maintainer signed goes blocked on the next check.">
        {live.length === 0 ? (
          <p className="text-[14px] text-muted">No live co-maintainer keys.</p>
        ) : (
          <>
            <select value={pick} onChange={(e) => setPick(e.target.value)} className="num h-11 w-full rounded-xl border border-line bg-bg px-3 text-[13px]">
              {live.map((k) => <option key={k.subname} value={`${k.org}/${k.label}`}>{k.subname}</option>)}
            </select>
            {wallet.address ? (
              <button
                className="btn btn-primary mt-3 w-full"
                disabled={busy === "rev"}
                onClick={() =>
                  wrap("rev", async () => {
                    const ownerSig = await wallet.sign(`thanks:revoke:${org}:${label}`);
                    const r = await api.revoke({ org, label, ownerSig });
                    setMsg({ kind: "ok", text: `${r.subname} revoked.`, tx: r.tx ?? undefined });
                  })
                }
              >
                {busy === "rev" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Revoke with owner wallet
              </button>
            ) : (
              <button className="btn btn-ghost mt-3 w-full" onClick={wallet.connect}>Connect owner wallet</button>
            )}
          </>
        )}
      </Panel>

      <Panel Icon={KeyRound} title="Unauthorised write" body="A co-maintainer tries to write status. EAC reverts it, because their role covers attest.key only.">
        <button
          className="btn btn-ghost w-full"
          disabled={!live.length || busy === "unauth"}
          onClick={() =>
            wrap("unauth", async () => {
              const r = await api.unauthorized({ org, label, key: "status" });
              setMsg(r.reverted ? { kind: "ok", text: `Reverted: ${r.error}` } : { kind: "err", text: "The write was not rejected." });
            })
          }
        >
          {busy === "unauth" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Try writing status
        </button>
      </Panel>

      {msg && (
        <p className={`lg:col-span-3 rounded-xl border px-4 py-3 text-[14px] ${msg.kind === "ok" ? "border-accent/30 bg-accent/10 text-accent" : "border-danger/30 bg-danger/10 text-danger"}`}>
          {msg.text} {msg.tx && <ExplorerLink k={{ type: "evm-tx", chainId: 11155111, id: msg.tx }} className="ml-2" />}
        </p>
      )}
    </div>
  );
}
