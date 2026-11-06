"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Wallet } from "lucide-react";
import { useWallet } from "@/lib/useWallet";
import { short } from "@/lib/format";

/** The one place to connect MetaMask, top right of the app. */
export function WalletButton() {
  const w = useWallet();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!mounted) return <div className="h-11 w-[168px]" />;

  if (!w.address)
    return (
      <div className="flex flex-col items-end">
        <button className="btn btn-primary !min-h-11 !px-4" onClick={w.connect}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brands/metamask.svg" alt="" width={18} height={18} className="h-[18px] w-[18px]" />
          Connect wallet
        </button>
        {w.error && <span className="mt-1 max-w-[260px] text-right text-[12px] text-danger">{w.error}</span>}
      </div>
    );

  return (
    <div ref={box} className="relative">
      <button className="btn btn-ghost !min-h-11 !px-4 bg-surface" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="h-2 w-2 bg-accent" aria-hidden />
        <span className="num normal-case tracking-normal">{short(w.address, 6, 4)}</span>
        <ChevronDown className="h-4 w-4" aria-hidden />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-64 border border-line-strong bg-surface p-2 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.35)]">
          <p className="flex items-center gap-2 px-3 py-2 text-[12px] text-muted"><Wallet className="h-4 w-4" aria-hidden /> MetaMask · Sepolia signatures</p>
          <a className="block px-3 py-2 text-[13px] hover:bg-bg" target="_blank" rel="noreferrer" href={`https://sepolia.etherscan.io/address/${w.address}`}>View on Etherscan</a>
          <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-danger hover:bg-bg" onClick={() => { void w.disconnect(); setOpen(false); }}>
            <LogOut className="h-4 w-4" aria-hidden /> Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
