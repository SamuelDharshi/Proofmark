import { Hono } from "hono";
import { verifyMessage, getAddress, isAddress } from "viem";
import { caps, env } from "../config";
import { store, logEvent } from "../store";
import { getServer, verifyNameOwnership } from "../registry";
import { rpSignature, verifyHumanProof, recordNullifier, worldStatus } from "../world";
import * as ens from "../ens";
import { orgInfra, readOrg, readKey, readServerClaim, registerServer } from "../chain";

export const claimRoutes = new Hono();

const slug = (s: string) => /^[a-z0-9][a-z0-9-]{1,30}$/.test(s);
const DAY = 86_400;

/** Name ownership is the official registry's own verification. There is no bypass. */
async function ownership(server: string) {
  const s = await getServer(server);
  if (!s) return { ok: false, method: "none", detail: "Not found in the official MCP registry" };
  return verifyNameOwnership(server, s);
}

claimRoutes.get("/world/config", (c) => c.json(worldStatus()));

/** RP signature is minted on the backend only. */
claimRoutes.post("/world/rp-signature", (c) => {
  try {
    return c.json(rpSignature());
  } catch (e) {
    return c.json({ error: (e as Error).message }, 503);
  }
});

/** Step 1: registry-verified name ownership. No challenge file. */
claimRoutes.post("/claim/ownership", async (c) => {
  const { server } = (await c.req.json()) as { server: string };
  if (!server) return c.json({ error: "server is required" }, 400);
  if (await readServerClaim(server).catch(() => null)) return c.json({ ok: false, method: "claimed", detail: "This server is already claimed on ENS." }, 409);
  const o = await ownership(server).catch((e) => ({ ok: false, method: "error", detail: (e as Error).message }));
  const meta = await getServer(server).catch(() => null);
  return c.json({ ...o, title: meta?.title ?? meta?.name, version: meta?.version, description: meta?.description });
});

/** Steps 2 to 4: Proof of Human, then the one-time ENS writes. */
claimRoutes.post("/claim", async (c) => {
  if (!caps.ens) return c.json({ error: "ens-not-configured", message: "ENS is not configured on this gateway." }, 503);
  const b = (await c.req.json()) as { server: string; org: string; owner: string; payTo: string; price?: number; idkitResponse: unknown };
  if (!b.server || !slug(b.org ?? "") || !isAddress(b.owner ?? "") || !/^\d+\.\d+\.\d+$/.test(b.payTo ?? ""))
    return c.json({ error: "server, org (a-z, 0-9, -), owner address and Hedera payTo account are required" }, 400);
  const owner = getAddress(b.owner);

  if (await readServerClaim(b.server)) return c.json({ error: "already-claimed", message: "This server is already claimed on ENS." }, 409);
  const existing = await orgInfra(b.org);
  if (existing) {
    const o = await readOrg(ens.orgName(b.org));
    if (o.owner?.toLowerCase() !== owner.toLowerCase()) return c.json({ error: "org-taken", message: "That org name is owned by someone else." }, 409);
  }

  const own = await ownership(b.server).catch(() => ({ ok: false, method: "error", detail: "registry lookup failed" }));
  if (!own.ok) return c.json({ error: "ownership-failed", ...own }, 403);

  // Validate on the backend. The client result is never trusted.
  const proof = await verifyHumanProof(b.idkitResponse);
  if (!proof.ok) {
    logEvent({ kind: "claim-rejected", server: b.server, detail: proof.message });
    return c.json({ error: proof.reason, message: proof.message }, proof.reason === "duplicate" ? 409 : proof.reason === "not-configured" ? 503 : 400);
  }

  const price = Math.min(b.price ?? env.CONNECT_PRICE_USD, env.MAX_PRICE_USD);
  const expiresAt = Math.floor(Date.now() / 1000) + 365 * DAY;
  const txs: { label: string; hash: string }[] = [];
  try {
    if (!existing) {
      const chain = await ens.registerOrg({ org: b.org, owner, payTo: b.payTo, price, worldVerified: true, expiresAt });
      txs.push(...chain.txs);
      ens.watchResolver(chain.resolver);
    }
    const srv = await registerServer({ server: b.server, org: b.org, owner, expiresAt });
    txs.push(...srv.txs);
  } catch (e) {
    return c.json({ error: "ens-failed", message: (e as Error).message }, 502);
  }

  recordNullifier(proof.nullifier, b.org);
  // Display index only. The decisions are made from ENS.
  store.update((d) => {
    if (!d.orgs.some((o) => o.name === b.org)) d.orgs.push({ name: b.org, ensName: ens.orgName(b.org), owner, payTo: b.payTo, price, worldVerified: true, nullifier: proof.nullifier, createdAt: Date.now() });
    d.claims.push({ server: b.server, org: b.org, claimedAt: Date.now(), ownershipProof: `${own.method}: ${own.detail}` });
  });
  logEvent({ kind: "claim", server: b.server, detail: `${b.server} claimed by ${ens.orgName(b.org)}`, tx: { chain: "sepolia", id: txs.at(-1)!.hash } });
  return c.json({ ok: true, org: { name: b.org, ensName: ens.orgName(b.org), ensTx: txs.at(-1)?.hash }, txs });
});

// ---- owner-signed actions. The owner is whoever the org's ENS `owner` record says. ----
async function requireOwner(org: string, message: string, sig: string) {
  const o = await readOrg(ens.orgName(org));
  if (!o.owner) return null;
  const ok = await verifyMessage({ address: getAddress(o.owner), message, signature: sig as `0x${string}` }).catch(() => false);
  return ok ? o : null;
}

claimRoutes.post("/comaintainers", async (c) => {
  if (!caps.ens) return c.json({ error: "ens-not-configured" }, 503);
  const b = (await c.req.json()) as { org: string; label: string; address: string; expiresAt: number; ownerSig: string };
  if (!slug(b.label ?? "") || !isAddress(b.address ?? "") || !(b.expiresAt > Date.now() / 1000)) return c.json({ error: "label, address and a future expiry are required" }, 400);
  if (!(await requireOwner(b.org, `proofmark:add-comaintainer:${b.org}:${b.label}:${b.address}:${b.expiresAt}`, b.ownerSig))) return c.json({ error: "owner signature required" }, 403);
  const infra = await orgInfra(b.org);
  if (!infra) return c.json({ error: "org is not on-chain" }, 404);
  const sub = `${b.label}.${ens.orgName(b.org)}`;
  if ((await readKey(sub)).address) return c.json({ error: "that co-maintainer already exists" }, 409);

  let r;
  try {
    r = await ens.addCoMaintainer({ org: b.org, resolver: infra.resolver, registry: infra.registry, label: b.label, address: getAddress(b.address), expiresAt: b.expiresAt });
  } catch (e) {
    return c.json({ error: "ens-failed", message: (e as Error).message }, 502);
  }
  const tx = r.txs.at(-1)?.hash;
  store.update((d) => void d.keys.push({ subname: r.subname, label: b.label, org: b.org, address: getAddress(b.address), expiresAt: b.expiresAt, revoked: false, registry: infra.registry, ensTx: tx }));
  logEvent({ kind: "comaintainer", detail: `${r.subname} added, expires ${new Date(b.expiresAt * 1000).toISOString().slice(0, 10)}`, tx: tx ? { chain: "sepolia", id: tx } : undefined });
  return c.json({ ok: true, subname: r.subname, txs: r.txs });
});

/** One write revokes one co-maintainer. Their siblings' attestations stand. */
claimRoutes.post("/revoke", async (c) => {
  if (!caps.ens) return c.json({ error: "ens-not-configured" }, 503);
  const b = (await c.req.json()) as { org: string; label: string; ownerSig: string };
  if (!(await requireOwner(b.org, `proofmark:revoke:${b.org}:${b.label}`, b.ownerSig))) return c.json({ error: "owner signature required" }, 403);
  const infra = await orgInfra(b.org);
  const key = await readKey(`${b.label}.${ens.orgName(b.org)}`);
  if (!infra || !key.address) return c.json({ error: "unknown co-maintainer" }, 404);

  let r;
  try {
    r = await ens.revokeCoMaintainer({ org: b.org, resolver: infra.resolver, label: b.label, address: key.address as `0x${string}` });
  } catch (e) {
    return c.json({ error: "ens-failed", message: (e as Error).message }, 502);
  }
  store.update((d) => {
    const k = d.keys.find((x) => x.org === b.org && x.label === b.label);
    if (k) Object.assign(k, { revoked: true, revokedAt: Date.now(), ensTx: r.revoke });
  });
  logEvent({ kind: "revoked", detail: `${r.subname} revoked. Everything it signed goes blocked.`, tx: { chain: "sepolia", id: r.revoke } });
  return c.json({ ok: true, subname: r.subname, tx: r.revoke });
});

/** Show that a co-maintainer cannot write status or payto. An eth_call, no key needed. */
claimRoutes.post("/ens/unauthorized-demo", async (c) => {
  if (!caps.ens) return c.json({ error: "ENS is not configured" }, 503);
  const { org, label, key } = (await c.req.json()) as { org: string; label: string; key?: string };
  const infra = await orgInfra(org);
  const k = await readKey(`${label}.${ens.orgName(org)}`);
  if (!infra || !k.address) return c.json({ error: "unknown org or co-maintainer" }, 404);
  return c.json(await ens.unauthorizedWriteDemo({ resolver: infra.resolver, org, from: k.address as `0x${string}`, key }));
});
