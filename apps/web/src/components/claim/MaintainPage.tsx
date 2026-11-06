"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Layers } from "./Layers";
import { Maintainers } from "./Maintainers";

const input = "num h-11 w-full border border-line bg-bg px-3.5 text-[14px] outline-none transition-colors placeholder:text-faint focus:border-accent/60";

/** Where an owner returns after the claim: the bond, co-maintainers and attestations for a server they claimed. */
export function MaintainPage() {
  const params = useSearchParams();
  const [server, setServer] = useState(params.get("server") ?? "io.github.SamuelDharshi/proofmark-files");
  const [org, setOrg] = useState(params.get("org") ?? "");
  const ready = server.trim() && org.trim();

  // Fill the org from ENS when the server is already claimed, so the owner never has to remember it.
  useEffect(() => {
    if (org || !server.trim()) return;
    const t = setTimeout(() => {
      api.check(server.trim()).then((r) => { if (r.org) setOrg(r.org.split(".")[0]); }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [server, org]);

  return (
    <div className="mx-auto max-w-[760px]">
      <p className="font-pixel text-[13px] tracking-widest text-accent">MAINTAIN</p>
      <h1 className="mt-2 font-hero text-[clamp(38px,4.6vw,60px)] font-medium leading-none tracking-[-0.03em]">Your claimed server.</h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">Post the bond, add a co-maintainer key and publish an attestation. Each step is one signature from your wallet.</p>

      <div className="card mt-8 space-y-5 p-6">
        <label className="block">
          <span className="mb-1.5 block text-[13px] text-muted">Registry name</span>
          <input className={input} value={server} onChange={(e) => setServer(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] text-muted">Org you claimed it under</span>
          <input className={input} value={org} onChange={(e) => setOrg(e.target.value.toLowerCase())} placeholder="sam" />
        </label>
        {ready ? (
          <div className="space-y-6 border-t border-line pt-6">
            <Layers server={server.trim()} org={org.trim()} />
            <Maintainers server={server.trim()} org={org.trim()} />
          </div>
        ) : (
          <p className="text-[13px] text-muted">Enter the org to continue.</p>
        )}
      </div>
    </div>
  );
}
