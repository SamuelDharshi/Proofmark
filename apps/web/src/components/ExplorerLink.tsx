"use client";
import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { ensAppUrl, evmAddressUrl, evmTxUrl, hederaAccountUrl, hederaTokenUrl, hederaTopicUrl, hederaTxUrl } from "@proofmark/core";
import { short } from "@/lib/format";

export type Kind =
  | { type: "hedera-tx"; id: string }
  | { type: "hedera-account"; id: string }
  | { type: "hedera-topic"; id: string }
  | { type: "hedera-token"; id: string }
  | { type: "evm-tx"; chainId: number; id: string }
  | { type: "evm-address"; chainId: number; id: string }
  | { type: "ens"; id: string };

export const urlFor = (k: Kind) =>
  k.type === "hedera-tx" ? hederaTxUrl(k.id)
  : k.type === "hedera-account" ? hederaAccountUrl(k.id)
  : k.type === "hedera-topic" ? hederaTopicUrl(k.id)
  : k.type === "hedera-token" ? hederaTokenUrl(k.id)
  : k.type === "evm-tx" ? evmTxUrl(k.chainId, k.id)
  : k.type === "evm-address" ? evmAddressUrl(k.chainId, k.id)
  : ensAppUrl(k.id);

/** Every hash, address and name links to its explorer in a new tab, truncated, with a copy button. */
export function ExplorerLink({ k, label, className = "" }: { k: Kind; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  const text = label ?? (k.type === "ens" ? k.id : short(k.id, 8, 6));
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <a href={urlFor(k)} target="_blank" rel="noreferrer" className="num link inline-flex items-center gap-1 text-[13px] text-text hover:text-accent" title={k.id}>
        {text}
        <ExternalLink className="h-3 w-3 opacity-60" aria-hidden />
      </a>
      <button
        type="button"
        aria-label="Copy"
        className="grid h-6 w-6 place-items-center text-faint transition-colors hover:text-text"
        onClick={() => {
          navigator.clipboard.writeText(k.id);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        }}
      >
        {done ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}
