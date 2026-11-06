import { createHash } from "node:crypto";
import { zeroAddress, getAddress, type Address } from "viem";
import { env } from "./config";
import * as ens from "./ens";

/**
 * The on-chain source of truth. Everything the gateway decides on (who claimed a server, what an org
 * charges and who it pays, whether a key is live, an agent's budget and Agent Pass) is read from ENS.
 * The gateway's own JSON file keeps only a list of names it has written, for display.
 */
const DAY = 86_400;
const nowSec = () => Math.floor(Date.now() / 1000);
const { C } = ens;

// ---- infrastructure, derived from the chain ----

export async function rootRegistry(): Promise<Address | null> {
  const r = (await ens.publicClient().readContract({
    address: C.ETHRegistry.address, abi: C.ETHRegistry.abi, functionName: "getSubregistry", args: [ens.rootLabel()],
  })) as Address;
  return r === zeroAddress ? null : r;
}

/** Resolver and subname registry of a maintainer org, read from the root registry. */
export async function orgInfra(org: string): Promise<{ resolver: Address; registry: Address } | null> {
  const root = await rootRegistry();
  if (!root) return null;
  const pc = ens.publicClient();
  const [resolver, registry] = (await Promise.all([
    pc.readContract({ address: root, abi: C.UserRegistryImpl.abi, functionName: "getResolver", args: [org] }),
    pc.readContract({ address: root, abi: C.UserRegistryImpl.abi, functionName: "getSubregistry", args: [org] }),
  ])) as [Address, Address];
  return resolver === zeroAddress ? null : { resolver, registry };
}

// ---- server names: <label>.<root>, resolving to the claiming org ----

/** Deterministic ENS label for a registry name, so any name can be looked up with no index. */
export function serverLabel(server: string): string {
  let l = server.toLowerCase().replace(/\//g, "--").replace(/[^a-z0-9-]/g, "-");
  if (l.length > 60) l = `${l.slice(0, 48)}-${createHash("sha256").update(server).digest("hex").slice(0, 10)}`;
  return l;
}
export const serverEns = (server: string) => `${serverLabel(server)}.${env.ENS_ROOT_NAME}`;

/** Which org, if any, has claimed this server. An unclaimed name has no record, which is the wildcard answer. */
export async function readServerClaim(server: string): Promise<{ org: string } | null> {
  const name = serverEns(server);
  const [mcp, org] = await Promise.all([ens.getText(name, "mcp.name"), ens.getText(name, "org")]);
  return mcp === server && org ? { org } : null;
}

export async function registerServer(p: { server: string; org: string; owner: Address; expiresAt: number }) {
  const infra = await orgInfra(p.org);
  if (!infra) throw new Error(`org ${p.org} is not on-chain`);
  const root = await rootRegistry();
  if (!root) throw new Error("root registry is not set up");
  if (await readServerClaim(p.server)) throw new Error("this server is already claimed on-chain");
  const name = serverEns(p.server);
  const txs: { label: string; hash: `0x${string}` }[] = [];
  txs.push({
    label: "server name",
    hash: await ens.send(root, C.UserRegistryImpl.abi, "register", [serverLabel(p.server), p.owner, zeroAddress, infra.resolver, ens.R.RENEW, BigInt(p.expiresAt)]),
  });
  txs.push({
    label: "server records",
    hash: await ens.send(infra.resolver, C.PermissionedResolverImpl.abi, "multicall", [[
      ens.setTextCall(name, "mcp.name", p.server),
      ens.setTextCall(name, "org", ens.orgName(p.org)),
    ]]),
  });
  ens.invalidateEns(name);
  return { name, txs };
}

// ---- orgs and keys ----

export interface OrgRecords {
  ensName: string;
  status: string | null;
  payto: string | null;
  price: number | null;
  worldVerified: boolean;
  owner: string | null;
  bondTx: string | null;
  bondStatus: string | null;
  domainVerified: string | null;
}
export async function readOrg(orgEns: string): Promise<OrgRecords> {
  const [status, payto, price, world, owner, bondTx, bondStatus, domain] = await Promise.all(["status", "payto", "x402.price", "world.verified", "owner", "bond.tx", "bond.status", "domain.verified"].map((k) => ens.getText(orgEns, k)));
  return { ensName: orgEns, status, payto, price: price ? Number(price) : null, worldVerified: world === "true", owner, bondTx, bondStatus, domainVerified: domain };
}

export interface KeyRecord {
  subname: string;
  address: string | null;
  expiresAt: number;
  live: boolean;
  expired: boolean;
}
/** A co-maintainer key is live when its attest.key record is set and its expiry has not passed. Revoking clears the record. */
export async function readKey(subname: string): Promise<KeyRecord> {
  const [key, exp] = await Promise.all([ens.getText(subname, "attest.key"), ens.getText(subname, "attest.expires")]);
  const expiresAt = exp ? Number(exp) : 0;
  const expired = expiresAt !== 0 && expiresAt < nowSec();
  let address: string | null = null;
  try {
    address = key ? getAddress(key) : null;
  } catch {
    address = null;
  }
  return { subname, address, expiresAt, expired, live: !!address && !expired };
}

// ---- agents as namespaces: <label>.agents.<root> ----

export const agentEns = (label: string) => `${label}.agents.${env.ENS_ROOT_NAME}`;

export interface AgentRecord {
  ensName: string;
  uaid?: string;
  erc8004?: string;
  hedera: string;
  evm: string;
  budgetUsd: number;
  maxRisk: "green" | "sandboxed";
  allowedTools: string[];
  pass: { iss?: string; sub?: string; authTime?: number; acr?: string; maxAgeSec?: number };
}

export async function readAgent(ensName: string): Promise<AgentRecord | null> {
  const keys = ["hedera", "evm", "budget", "maxrisk", "allowed.tools", "pass.iss", "pass.sub", "pass.auth_time", "pass.acr", "pass.maxage", "hcs14.uaid", "erc8004"];
  const [hedera, evm, budget, maxrisk, tools, iss, sub, auth, acr, maxage, uaid, erc8004] = await Promise.all(keys.map((k) => ens.getText(ensName, k)));
  if (!evm || !hedera) return null;
  return {
    ensName, hedera, evm,
    uaid: uaid ?? undefined,
    erc8004: erc8004 ?? undefined,
    budgetUsd: budget ? Number(budget) : 0,
    maxRisk: maxrisk === "sandboxed" ? "sandboxed" : "green",
    allowedTools: tools ? tools.split(",").map((s) => s.trim()).filter(Boolean) : [],
    pass: { iss: iss ?? undefined, sub: sub ?? undefined, authTime: auth ? Number(auth) : undefined, acr: acr ?? undefined, maxAgeSec: maxage ? Number(maxage) : undefined },
  };
}

async function agentsInfra() {
  const infra = await orgInfra("agents");
  if (infra) return infra;
  const chain = await ens.registerOrg({
    org: "agents", owner: ens.adminAddress(), payTo: env.HEDERA_GATEWAY_ACCOUNT_ID ?? "0.0.0", price: 0, worldVerified: false, expiresAt: nowSec() + 365 * DAY,
  });
  return { resolver: chain.resolver, registry: chain.registry };
}

export async function registerAgent(p: { label: string; hedera: string; evm: Address; budgetUsd: number; maxRisk: "green" | "sandboxed"; allowedTools: string[] }) {
  const infra = await agentsInfra();
  const name = agentEns(p.label);
  const txs: { label: string; hash: `0x${string}` }[] = [];
  txs.push({ label: "agent name", hash: await ens.send(infra.registry, C.UserRegistryImpl.abi, "register", [p.label, ens.adminAddress(), zeroAddress, infra.resolver, 0n, BigInt(nowSec() + 365 * DAY)]) });
  txs.push({
    label: "agent records",
    hash: await ens.send(infra.resolver, C.PermissionedResolverImpl.abi, "multicall", [[
      ens.setTextCall(name, "hedera", p.hedera),
      ens.setTextCall(name, "evm", p.evm),
      ens.setTextCall(name, "budget", String(p.budgetUsd)),
      ens.setTextCall(name, "maxrisk", p.maxRisk),
      ens.setTextCall(name, "allowed.tools", p.allowedTools.join(",")),
    ]]),
  });
  ens.invalidateEns(name);
  return { name, txs };
}

/** Record a validated World Agent Pass on the agent's ENS name. Clearing it revokes spend authority at once. */
export async function writePass(ensName: string, p: { iss: string; sub: string; authTime: number; acr: string } | null) {
  const infra = await orgInfra("agents");
  if (!infra) throw new Error("agents org is not on-chain");
  const v = p ?? { iss: "", sub: "", authTime: "" as unknown as number, acr: "" };
  const hash = await ens.send(infra.resolver, C.PermissionedResolverImpl.abi, "multicall", [[
    ens.setTextCall(ensName, "pass.iss", v.iss),
    ens.setTextCall(ensName, "pass.sub", v.sub),
    ens.setTextCall(ensName, "pass.auth_time", p ? String(p.authTime) : ""),
    ens.setTextCall(ensName, "pass.acr", v.acr),
  ]]);
  ens.invalidateEns(ensName);
  return hash;
}

/** Identity records on the agent's ENS name: the HCS-14 UAID and the ERC-8004 registry reference. */
export async function writeAgentIdentity(label: string, p: { uaid: string; erc8004: string }) {
  const infra = await agentsInfra();
  const name = agentEns(label);
  const hash = await ens.send(infra.resolver, C.PermissionedResolverImpl.abi, "multicall", [[
    ens.setTextCall(name, "hcs14.uaid", p.uaid),
    ens.setTextCall(name, "erc8004", p.erc8004),
  ]]);
  ens.invalidateEns(name);
  return hash;
}

/** Who the root registry says owns an org's name. Used to decide whether an unfinished org may be resumed. */
export async function orgNameOwner(org: string): Promise<Address | null> {
  const root = await rootRegistry();
  if (!root) return null;
  const st = (await ens.publicClient().readContract({ address: root, abi: C.UserRegistryImpl.abi, functionName: "getState", args: [ens.anyId(org)] })) as { latestOwner: Address };
  return st.latestOwner === zeroAddress ? null : st.latestOwner;
}

/** Extra text records on an org's own resolver, such as the bond and the verified namespace. */
export async function writeOrgTexts(org: string, entries: Record<string, string>) {
  const infra = await orgInfra(org);
  if (!infra) throw new Error(`org ${org} is not on-chain`);
  const name = ens.orgName(org);
  const hash = await ens.send(infra.resolver, C.PermissionedResolverImpl.abi, "multicall", [Object.entries(entries).map(([k, v]) => ens.setTextCall(name, k, v))]);
  ens.invalidateEns(name);
  return hash;
}
