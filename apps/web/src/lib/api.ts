import type { CheckResult } from "@thanks/core";

export const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:8787";

export class ApiError extends Error {
  constructor(public status: number, public body: any) {
    super(body?.message ?? body?.error ?? `HTTP ${status}`);
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${GATEWAY}${path}`, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, body);
  return body as T;
}
const post = <T,>(path: string, data: unknown) => req<T>(path, { method: "POST", body: JSON.stringify(data) });

export interface ServerRow extends CheckResult {
  title?: string;
  description?: string;
  source: string;
  kind?: string;
  toolCount: number | null;
  priceUsd: number;
}
export interface Config {
  caps: Record<"hedera" | "hcs" | "signing" | "ens" | "world" | "agent", boolean>;
  asset: string;
  defaultPriceUsd: number;
  maxPriceUsd: number;
  agentPassMode: "live" | "mock";
  world: { environment: string; appId: string | null; action: string };
  ens: { root: string; chainId: number; contracts: Record<string, string>; admin: string | null };
  hedera: { gatewayAccount: string | null; gatewayAccountUrl: string | null; topic: string | null; topicUrl: string | null };
}
export interface FleetAgent {
  ensName: string; hederaAccount: string; evmAddress: string; budgetUsd: number; spentUsd: number; budgetLeft: number;
  maxRisk: string; passValid: boolean; pass: { valid: boolean; message: string; mode: string; reason?: string };
  last?: { kind: string; detail: string; ts: number };
}
export interface EventRow { id: string; ts: number; kind: string; server?: string; agent?: string; detail: string; tx?: { chain: "hedera" | "sepolia"; id: string } }
export interface Payment { id: string; txId: string; buyer: string; server: string; usd: number; payTo: string; ts: number; hcs?: { topic: string; sequence: number; tx: string } }
export interface Fleet {
  agents: FleetAgent[]; events: EventRow[]; payments: Payment[];
  orgs: { name: string; ensName: string; owner: string; payTo: string; price: number; worldVerified: boolean; ensTx?: string }[];
  keys: { subname: string; label: string; org: string; address: string; expiresAt: number; revoked: boolean; ensTx?: string }[];
  claims: { server: string; org: string; claimedAt: number }[];
}

export const api = {
  config: () => req<Config>("/config"),
  servers: (search?: string) => req<{ servers: ServerRow[] }>(`/servers${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  check: (server: string) => req<CheckResult & { keySource: string | null; divergent?: number }>(`/check?server=${encodeURIComponent(server)}`),
  fleet: () => req<Fleet>("/fleet"),
  hcs: () => req<{ topic: string | null; topicUrl: string | null; messages: { sequence: number; consensusTimestamp: string; body: any }[] }>("/hcs"),
  rpSignature: () => post<any>("/world/rp-signature", {}),
  ownership: (server: string) => post<{ ok: boolean; method: string; detail: string; title?: string; version?: string; description?: string }>("/claim/ownership", { server }),
  claim: (b: unknown) => post<any>("/claim", b),
  addCoMaintainer: (b: unknown) => post<any>("/comaintainers", b),
  revoke: (b: unknown) => post<any>("/revoke", b),
  unauthorized: (b: unknown) => post<{ reverted: boolean; error?: string; key: string }>("/ens/unauthorized-demo", b),
  runAttest: (b: unknown) => post<any>("/attest/run", b),
  approveAttest: (b: unknown) => post<any>("/attest/approve", b),
  setPass: (name: string, valid: boolean) => post<any>(`/agents/${encodeURIComponent(name)}/pass`, { valid }),
  mutation: () => req<{ mutated: boolean }>("/demo/mutation"),
  setMutation: (on: boolean) => post<{ mutated: boolean }>("/demo/mutation", { on }),
};
