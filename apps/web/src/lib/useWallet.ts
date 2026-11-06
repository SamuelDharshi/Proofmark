"use client";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { toHex } from "viem";

interface Eip1193 {
  request(a: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(ev: string, cb: (...a: any[]) => void): void;
  removeListener?(ev: string, cb: (...a: any[]) => void): void;
}
const eth = () => (typeof window !== "undefined" ? ((window as any).ethereum as Eip1193 | undefined) : undefined);

/**
 * One wallet connection for the whole app. Nothing connects until the person presses Connect,
 * and Disconnect stays disconnected after a reload, even though MetaMask still remembers the site.
 */
const KEY = "proofmark.wallet";
type State = { address: `0x${string}` | null; error: string | null };
let state: State = { address: null, error: null };
const subs = new Set<() => void>();
const set = (s: Partial<State>) => {
  state = { ...state, ...s };
  subs.forEach((f) => f());
};
const remembered = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};
const remember = (on: boolean) => {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {}
};

let started = false;
function start() {
  if (started) return;
  started = true;
  const e = eth();
  if (!e) return;
  if (remembered()) e.request({ method: "eth_accounts" }).then((a) => set({ address: ((a as string[])[0] as `0x${string}`) ?? null })).catch(() => {});
  e.on?.("accountsChanged", (a: string[]) => {
    if (!remembered()) return;
    set({ address: (a[0] as `0x${string}`) ?? null });
    if (!a[0]) remember(false);
  });
}

export function useWallet() {
  const s = useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => state,
    () => state,
  );
  useEffect(start, []);
  const available = typeof window !== "undefined" && !!eth();

  const connect = useCallback(async () => {
    const e = eth();
    if (!e) {
      set({ error: "No wallet found. Install MetaMask." });
      return null;
    }
    try {
      const a = (await e.request({ method: "eth_requestAccounts" })) as string[];
      remember(true);
      set({ address: a[0] as `0x${string}`, error: null });
      return a[0] as `0x${string}`;
    } catch (err) {
      set({ error: (err as Error).message });
      return null;
    }
  }, []);

  const disconnect = useCallback(async () => {
    remember(false);
    set({ address: null, error: null });
    // Ask MetaMask to drop the site's permission too, where it supports it.
    await eth()?.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] }).catch(() => {});
  }, []);

  const sign = useCallback(async (message: string) => {
    const e = eth();
    if (!e || !state.address) throw new Error("Connect your wallet first, top right.");
    return (await e.request({ method: "personal_sign", params: [toHex(message), state.address] })) as `0x${string}`;
  }, []);

  return { address: s.address, error: s.error, connect, disconnect, sign, available };
}
