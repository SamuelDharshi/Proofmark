"use client";
import { useCallback, useEffect, useState } from "react";
import { toHex } from "viem";

interface Eip1193 {
  request(a: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(ev: string, cb: (...a: any[]) => void): void;
  removeListener?(ev: string, cb: (...a: any[]) => void): void;
}
const eth = () => (typeof window !== "undefined" ? ((window as any).ethereum as Eip1193 | undefined) : undefined);

/** Minimal injected-wallet hook. Used to prove owner control with personal_sign. */
export function useWallet() {
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);
  const available = typeof window !== "undefined" && !!eth();

  useEffect(() => {
    const e = eth();
    if (!e) return;
    e.request({ method: "eth_accounts" }).then((a) => setAddress(((a as string[])[0] as `0x${string}`) ?? null)).catch(() => {});
    const onAccounts = (a: string[]) => setAddress((a[0] as `0x${string}`) ?? null);
    e.on?.("accountsChanged", onAccounts);
    return () => e.removeListener?.("accountsChanged", onAccounts);
  }, []);

  const connect = useCallback(async () => {
    const e = eth();
    if (!e) {
      setError("No wallet found. Install a browser wallet.");
      return null;
    }
    try {
      const a = (await e.request({ method: "eth_requestAccounts" })) as string[];
      setAddress(a[0] as `0x${string}`);
      setError(null);
      return a[0] as `0x${string}`;
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, []);

  const sign = useCallback(
    async (message: string) => {
      const e = eth();
      if (!e || !address) throw new Error("Connect a wallet first");
      return (await e.request({ method: "personal_sign", params: [toHex(message), address] })) as `0x${string}`;
    },
    [address],
  );

  return { address, connect, sign, error, available };
}
