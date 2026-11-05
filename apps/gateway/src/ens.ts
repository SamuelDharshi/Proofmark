import {
  createPublicClient, createWalletClient, http, encodeFunctionData, decodeEventLog,
  keccak256, toHex, labelhash, getAddress, zeroAddress, BaseError, ContractFunctionRevertedError,
  type Address, type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { packetToBytes } from "viem/ens";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { env, caps } from "./config";

/** Addresses and ABIs are loaded from the ENS deployments table export, never hard-coded. */
const here = dirname(fileURLToPath(import.meta.url));
const dep = JSON.parse(readFileSync(resolve(here, "../ens/deployments.sepolia.json"), "utf8")) as {
  universalResolverProxy: Address;
  contracts: Record<string, { address: Address; abi: any[] }>;
};
const C = dep.contracts;
export const ensAddresses = Object.fromEntries(Object.entries(C).map(([k, v]) => [k, v.address])) as Record<string, Address>;

// Roles, from the ENSv2 docs. Admin role = role << 128.
export const R = {
  SET_ADDRESS: 1n << 0n,
  SET_TEXT: 1n << 4n,
  REGISTRAR: 1n << 0n,
  UNREGISTER: 1n << 12n,
  RENEW: 1n << 16n,
};
const admin = (r: bigint) => r << 128n;

const transport = () => http(env.SEPOLIA_RPC_URL);
export const publicClient = () => createPublicClient({ chain: sepolia, transport: transport() });
const account = () => {
  if (!caps.ens) throw new Error("ENS is not configured (SEPOLIA_RPC_URL, ENS_ADMIN_PRIVATE_KEY)");
  return privateKeyToAccount(env.ENS_ADMIN_PRIVATE_KEY as Hex);
};
const wallet = () => createWalletClient({ account: account(), chain: sepolia, transport: transport() });
export const adminAddress = () => account().address;

const dns = (name: string) => toHex(packetToBytes(name));
const anyId = (label: string) => BigInt(labelhash(label));
export const textResource = (key: string) => BigInt(keccak256(toHex(key)));
const rootLabel = () => env.ENS_ROOT_NAME.split(".")[0];
export const orgName = (org: string) => `${org}.${env.ENS_ROOT_NAME}`;

async function send(address: Address, abi: any[], functionName: string, args: any[]): Promise<Hex> {
  const pc = publicClient();
  const { request } = await pc.simulateContract({ account: account(), address, abi, functionName, args } as any);
  const hash = await wallet().writeContract(request as any);
  await pc.waitForTransactionReceipt({ hash });
  return hash;
}

/** Deploy a UUPS proxy through the Verifiable Factory. Returns the proxy address and tx. */
async function deployProxy(implementation: Address, data: Hex) {
  const pc = publicClient();
  const salt = BigInt(keccak256(toHex(`${Date.now()}-${Math.random()}`)));
  const tx = await send(C.VerifiableFactory.address, C.VerifiableFactory.abi, "deployProxy", [implementation, salt, data]);
  const receipt = await pc.getTransactionReceipt({ hash: tx });
  for (const log of receipt.logs) {
    try {
      const ev = decodeEventLog({ abi: C.VerifiableFactory.abi, data: log.data, topics: log.topics }) as any;
      if (ev.eventName === "ProxyDeployed") return { address: ev.args.proxyAddress as Address, tx };
    } catch {}
  }
  throw new Error("ProxyDeployed event not found");
}

const registryInit = (grants: { account: Address; roleBitmap: bigint }[]) =>
  encodeFunctionData({ abi: C.UserRegistryImpl.abi, functionName: "initialize", args: [grants] });
const resolverInit = (grants: { account: Address; roleBitmap: bigint }[]) =>
  encodeFunctionData({ abi: C.PermissionedResolverImpl.abi, functionName: "initialize", args: [grants, []] });

const registrarRoles = R.REGISTRAR | admin(R.REGISTRAR) | R.UNREGISTER | admin(R.UNREGISTER) | R.RENEW | admin(R.RENEW);
const resolverRoles = R.SET_TEXT | admin(R.SET_TEXT) | R.SET_ADDRESS | admin(R.SET_ADDRESS);

const setTextCall = (name: string, key: string, value: string) =>
  encodeFunctionData({ abi: C.PermissionedResolverImpl.abi, functionName: "setText", args: [dns(name), key, value] });

/** Make sure <root>.eth points at a subname registry the gateway can register into. */
export async function ensureRootRegistry(): Promise<{ registry: Address; tx?: Hex }> {
  const pc = publicClient();
  const current = (await pc.readContract({
    address: C.ETHRegistry.address, abi: C.ETHRegistry.abi, functionName: "getSubregistry", args: [rootLabel()],
  })) as Address;
  if (current !== zeroAddress) return { registry: current };
  const reg = await deployProxy(C.UserRegistryImpl.address, registryInit([{ account: adminAddress(), roleBitmap: registrarRoles }]));
  const tx = await send(C.ETHRegistry.address, C.ETHRegistry.abi, "setSubregistry", [anyId(rootLabel()), reg.address]);
  return { registry: reg.address, tx };
}

export interface OrgChain {
  org: string;
  name: string;
  resolver: Address;
  registry: Address;
  txs: { label: string; hash: Hex }[];
}

/** One-time write set for a claimed maintainer org. Nothing is written per attestation. */
export async function registerOrg(p: {
  org: string; owner: Address; payTo: string; price: number; worldVerified: boolean; expiresAt: number;
}): Promise<OrgChain> {
  const txs: OrgChain["txs"] = [];
  const root = await ensureRootRegistry();
  if (root.tx) txs.push({ label: "root registry", hash: root.tx });

  // One resolver instance per org so one org can never write another's payto.
  const resolver = await deployProxy(C.PermissionedResolverImpl.address, resolverInit([{ account: adminAddress(), roleBitmap: resolverRoles }]));
  txs.push({ label: "org resolver", hash: resolver.tx });
  const orgReg = await deployProxy(C.UserRegistryImpl.address, registryInit([{ account: adminAddress(), roleBitmap: registrarRoles }]));
  txs.push({ label: "org registry", hash: orgReg.tx });

  // The claimant owns the name and may only renew it. Resolver and subregistry stay with the gateway.
  txs.push({
    label: "register name",
    hash: await send(root.registry, C.UserRegistryImpl.abi, "register", [p.org, p.owner, orgReg.address, resolver.address, R.RENEW, BigInt(p.expiresAt)]),
  });

  const name = orgName(p.org);
  const records = { status: "claimed", payto: p.payTo, "x402.price": String(p.price), "world.verified": String(p.worldVerified), owner: p.owner };
  txs.push({
    label: "records",
    hash: await send(resolver.address, C.PermissionedResolverImpl.abi, "multicall", [Object.entries(records).map(([k, v]) => setTextCall(name, k, v))]),
  });
  invalidateEns(name);
  return { org: p.org, name, resolver: resolver.address, registry: orgReg.address, txs };
}

/** Co-maintainer subname with its own expiring key. Its role is scoped to the attest.key record only. */
export async function addCoMaintainer(p: {
  org: string; resolver: Address; registry: Address; label: string; address: Address; expiresAt: number;
}) {
  const txs: { label: string; hash: Hex }[] = [];
  const sub = `${p.label}.${orgName(p.org)}`;
  txs.push({ label: "subname", hash: await send(p.registry, C.UserRegistryImpl.abi, "register", [p.label, p.address, zeroAddress, p.resolver, 0n, BigInt(p.expiresAt)]) });
  const setter = encodeFunctionData({ abi: C.PermissionedResolverImpl.abi, functionName: "setText", args: ["0x", "attest.key", ""] });
  txs.push({ label: "attest.key role", hash: await send(p.resolver, C.PermissionedResolverImpl.abi, "grantSetterRoles", [setter, p.address]) });
  txs.push({
    label: "attest.key",
    hash: await send(p.resolver, C.PermissionedResolverImpl.abi, "multicall", [[setTextCall(sub, "attest.key", p.address), setTextCall(sub, "attest.expires", String(p.expiresAt))]]),
  });
  invalidateEns(sub);
  return { subname: sub, txs };
}

/** Revocation: one write clears the live key. Removing the role follows as cleanup. */
export async function revokeCoMaintainer(p: { org: string; resolver: Address; label: string; address: Address }) {
  const sub = `${p.label}.${orgName(p.org)}`;
  const revoke = await send(p.resolver, C.PermissionedResolverImpl.abi, "setText", [dns(sub), "attest.key", ""]);
  invalidateEns(sub);
  const cleanup = await send(p.resolver, C.PermissionedResolverImpl.abi, "revokeRoles", [textResource("attest.key"), R.SET_TEXT, p.address]).catch(() => null);
  return { subname: sub, revoke, cleanup };
}

/** A co-maintainer cannot write anything but attest.key. This runs as an eth_call, so no key is needed. */
export async function unauthorizedWriteDemo(p: { resolver: Address; org: string; from: Address; key?: string }) {
  const key = p.key ?? "status";
  try {
    await publicClient().simulateContract({
      account: p.from, address: p.resolver, abi: C.PermissionedResolverImpl.abi, functionName: "setText",
      args: [dns(orgName(p.org)), key, "tampered"],
    } as any);
    return { reverted: false as const, key };
  } catch (e) {
    let name = "revert";
    if (e instanceof BaseError) {
      const r = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
      name = r?.data?.errorName ?? r?.reason ?? e.shortMessage;
    }
    return { reverted: true as const, error: name, key };
  }
}

// ---- reads, cached 15 seconds, invalidated on our own writes ----
const cache = new Map<string, { v: string | null; t: number }>();
export const invalidateEns = (prefix?: string) => {
  for (const k of cache.keys()) if (!prefix || k.includes(prefix)) cache.delete(k);
};

/**
 * Invalidate the read cache the moment the chain says a record or role changed, so a revocation
 * made from any wallet reaches running agents within a block or two instead of waiting out the TTL.
 */
const watched = new Set<string>();
export function watchResolver(resolver: Address) {
  if (!caps.ens || watched.has(resolver.toLowerCase())) return;
  watched.add(resolver.toLowerCase());
  for (const eventName of ["TextUpdated", "EACRolesChanged"]) {
    publicClient().watchContractEvent({
      address: resolver,
      abi: C.PermissionedResolverImpl.abi,
      eventName,
      poll: true,
      pollingInterval: 4_000,
      onLogs: () => invalidateEns(),
      onError: (e) => console.warn(`[ens] watch ${eventName} ${resolver}: ${e.message}`),
    });
  }
}

export async function getText(name: string, key: string): Promise<string | null> {
  const ck = `${name}|${key}`;
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.t < 15_000) return hit.v;
  const v = await publicClient()
    .getEnsText({ name, key, universalResolverAddress: dep.universalResolverProxy })
    .catch(() => null);
  cache.set(ck, { v: v ?? null, t: Date.now() });
  return v ?? null;
}

export async function getOrgRecords(org: string) {
  const name = orgName(org);
  const [status, payto, price, world, owner] = await Promise.all(
    ["status", "payto", "x402.price", "world.verified", "owner"].map((k) => getText(name, k)),
  );
  return { name, status, payto, price: price ? Number(price) : null, worldVerified: world === "true", owner };
}

/** A co-maintainer key is live when its record matches and the subname has not expired. */
export async function keyLive(org: string, label: string, address: string, registry: Address) {
  const sub = `${label}.${orgName(org)}`;
  const [key, expiry] = await Promise.all([
    getText(sub, "attest.key"),
    publicClient()
      .readContract({ address: registry, abi: C.UserRegistryImpl.abi, functionName: "getExpiry", args: [anyId(label)] })
      .catch(() => 0n) as Promise<bigint>,
  ]);
  const expired = expiry !== 0n && Number(expiry) * 1000 < Date.now();
  const matches = !!key && getAddress(key) === getAddress(address);
  return { live: matches && !expired, expired, revoked: !matches, record: key, expiresAt: Number(expiry) };
}
