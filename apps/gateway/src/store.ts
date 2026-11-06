import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import type { McpTool, SignedAttestation } from "@proofmark/core";
import { dataDir } from "./config";

export interface Org {
  name: string; // acme
  ensName: string; // acme.proofmark.eth
  owner: string; // evm address of claimant
  payTo: string; // hedera account
  price: number; // usd per connect
  worldVerified: boolean;
  nullifier: string;
  createdAt: number;
  ensTx?: string;
  resolver?: string;
  registry?: string;
}
export interface ServerClaim {
  server: string; // registry name
  org: string;
  claimedAt: number;
  ownershipProof: string; // how registry ownership was verified
}
export interface MaintainerKey {
  subname: string; // alice.acme.proofmark.eth
  label: string; // alice
  registry?: string; // org subname registry address
  org: string;
  address: string;
  expiresAt: number;
  revoked: boolean;
  revokedAt?: number;
  ensTx?: string;
}
export interface AttestationRecord extends SignedAttestation {
  tools: McpTool[];
  createdAt: number;
  hcs?: { topic: string; sequence: number; tx: string };
}
/** A name this gateway registered. Everything about the agent (wallet, budget, pass) lives on ENS. */
export interface Agent {
  ensName: string;
  addedAt?: number;
}
export interface Payment {
  id: string;
  txId: string;
  buyer: string;
  server: string;
  version: string;
  amountTinybars: string;
  usd: number;
  payTo: string;
  ts: number;
  hcs?: { topic: string; sequence: number; tx: string };
}
export interface GossipReport {
  server: string;
  version: string;
  observedHash: string;
  client: string;
  ts: number;
}
export interface EventRow {
  id: string;
  ts: number;
  kind: string;
  server?: string;
  agent?: string;
  detail: string;
  tx?: { chain: "hedera" | "sepolia"; id: string };
}

export interface DB {
  orgs: Org[];
  claims: ServerClaim[];
  keys: MaintainerKey[];
  attestations: AttestationRecord[];
  nullifiers: { nullifier: string; action: string; org?: string; ts: number }[];
  agents: Agent[];
  payments: Payment[];
  gossip: GossipReport[];
  events: EventRow[];
}

const empty = (): DB => ({ orgs: [], claims: [], keys: [], attestations: [], nullifiers: [], agents: [], payments: [], gossip: [], events: [] });

const file = join(dataDir, "db.json");
mkdirSync(dataDir, { recursive: true });
let db: DB = existsSync(file) ? { ...empty(), ...JSON.parse(readFileSync(file, "utf8")) } : empty();

function persist() {
  const tmp = file + ".tmp";
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, file);
}

export const store = {
  get: () => db,
  /** Mutate then persist. */
  update<T>(fn: (d: DB) => T): T {
    const r = fn(db);
    persist();
    return r;
  },
  reset() {
    db = empty();
    persist();
  },
};

let n = 0;
export const uid = () => `${Date.now().toString(36)}${(n++).toString(36)}`;

export function logEvent(e: Omit<EventRow, "id" | "ts">) {
  store.update((d) => {
    d.events.unshift({ id: uid(), ts: Date.now(), ...e });
    d.events = d.events.slice(0, 500);
  });
}
