import { Hono } from "hono";
import { verifyMessage, getAddress, isAddress } from "viem";
import { caps, env } from "../config";
import { store, logEvent, type Org, type MaintainerKey } from "../store";
import { getServer, verifyNameOwnership } from "../registry";
import { isFixture, fixtureServer } from "../fixtures";
import { rpSignature, verifyHumanProof, recordNullifier, worldStatus } from "../world";
import * as ens from "../ens";

export const claimRoutes = new Hono();

const slug = (s: string) => /^[a-z0-9][a-z0-9-]{1,30}$/.test(s);
const DAY = 86_400;

async function ownership(server: string) {
  if (isFixture(server)) return { ok: true, method: "local fixture", detail: "Demo fixture bundled with the gateway" };
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
  if (store.get().claims.some((x) => x.server === server)) return c.json({ ok: false, method: "claimed", detail: "This server is already claimed." }, 409);
  const o = await ownership(server).catch((e) => ({ ok: false, method: "error", detail: (e as Error).message }));
  const meta = isFixture(server) ? fixtureServer(server) : await getServer(server).catch(() => null);
  return c.json({ ...o, title: meta?.title ?? meta?.name, version: meta?.version, description: meta?.description });
});

/** Steps 2 to 4: Proof of Human, then the one-time ENS writes. */
claimRoutes.post("/claim", async (c) => {
  const b = (await c.req.json()) as { server: string; org: string; owner: string; payTo: string; price?: number; idkitResponse: unknown };
  if (!b.server || !slug(b.org ?? "") || !isAddress(b.owner ?? "") || !/^\d+\.\d+\.\d+$/.test(b.payTo ?? ""))
    return c.json({ error: "server, org (a-z, 0-9, -), owner address and Hedera payTo account are required" }, 400);
  const db = store.get();
  if (db.claims.some((x) => x.server === b.server)) return c.json({ error: "already-claimed" }, 409);
  if (db.orgs.some((o) => o.name === b.org && o.owner.toLowerCase() !== b.owner.toLowerCase())) return c.json({ error: "org name taken" }, 409);

  const own = await ownership(b.server).catch(() => ({ ok: false, method: "error", detail: "registry lookup failed" }));
  if (!own.ok) return c.json({ error: "ownership-failed", ...own }, 403);

  // Validate on the backend. The client result is never trusted.
  const proof = await verifyHumanProof(b.idkitResponse);
  if (!proof.ok) {
    logEvent({ kind: "claim-rejected", server: b.server, detail: proof.message });
    return c.json({ error: proof.reason, message: proof.message }, proof.reason === "duplicate" ? 409 : proof.reason === "not-configured" ? 503 : 400);
  }

  const price = Math.min(b.price ?? env.CONNECT_PRICE_USD, env.MAX_PRICE_USD);
  const owner = getAddress(b.owner);
  let org = db.orgs.find((o) => o.name === b.org);

  if (!org) {
    org = { name: b.org, ensName: ens.orgName(b.org), owner, payTo: b.payTo, price, worldVerified: true, nullifier: proof.nullifier, createdAt: Date.now() };
    if (caps.ens) {
      try {
        const chain = await ens.registerOrg({ org: b.org, owner, payTo: b.payTo, price, worldVerified: true, expiresAt: Math.floor(Date.now() / 1000) + 365 * DAY });
        org.ensTx = chain.txs.at(-1)?.hash;
        org.resolver = chain.resolver;
        org.registry = chain.registry;
        ens.watchResolver(chain.resolver);
        logEvent({ kind: "ens", server: b.server, detail: `Registered ${org.ensName}`, tx: org.ensTx ? { chain: "sepolia", id: org.ensTx } : undefined });
      } catch (e) {
        return c.json({ error: "ens-failed", message: (e as Error).message }, 502);
      }
    }
    store.update((d) => void d.orgs.push(org!));
  }

  recordNullifier(proof.nullifier, b.org);
  store.update((d) => void d.claims.push({ server: b.server, org: b.org, claimedAt: Date.now(), ownershipProof: `${own.method}: ${own.detail}` }));
  logEvent({ kind: "claim", server: b.server, detail: `${b.server} claimed by ${org.ensName}` });
  return c.json({ ok: true, org, ens: caps.ens ? "onchain" : "not-configured" });
});

// ---- owner-signed actions ----
async function requireOwner(orgName: string, message: string, sig: string): Promise<Org | null> {
  const org = store.get().orgs.find((o) => o.name === orgName);
  if (!org) return null;
  const ok = await verifyMessage({ address: getAddress(org.owner), message, signature: sig as `0x${string}` }).catch(() => false);
  return ok ? org : null;
}

claimRoutes.post("/comaintainers", async (c) => {
  const b = (await c.req.json()) as { org: string; label: string; address: string; expiresAt: number; ownerSig: string };
  if (!slug(b.label ?? "") || !isAddress(b.address ?? "") || !(b.expiresAt > Date.now() / 1000)) return c.json({ error: "label, address and a future expiry are required" }, 400);
  const org = await requireOwner(b.org, `proofmark:add-comaintainer:${b.org}:${b.label}:${b.address}:${b.expiresAt}`, b.ownerSig);
  if (!org) return c.json({ error: "owner signature required" }, 403);
  if (store.get().keys.some((k) => k.org === org.name && k.label === b.label)) return c.json({ error: "label exists" }, 409);

  const key: MaintainerKey = { subname: `${b.label}.${org.ensName}`, label: b.label, org: org.name, address: getAddress(b.address), expiresAt: b.expiresAt, revoked: false, registry: org.registry };
  if (caps.ens && org.resolver && org.registry) {
    try {
      const r = await ens.addCoMaintainer({ org: org.name, resolver: org.resolver as `0x${string}`, registry: org.registry as `0x${string}`, label: b.label, address: key.address as `0x${string}`, expiresAt: b.expiresAt });
      key.ensTx = r.txs.at(-1)?.hash;
    } catch (e) {
      return c.json({ error: "ens-failed", message: (e as Error).message }, 502);
    }
  }
  store.update((d) => void d.keys.push(key));
  logEvent({ kind: "comaintainer", detail: `${key.subname} added, expires ${new Date(b.expiresAt * 1000).toISOString().slice(0, 10)}`, tx: key.ensTx ? { chain: "sepolia", id: key.ensTx } : undefined });
  return c.json({ ok: true, key });
});

/** One write revokes one co-maintainer. Their siblings' attestations stand. */
claimRoutes.post("/revoke", async (c) => {
  const b = (await c.req.json()) as { org: string; label: string; ownerSig: string };
  const org = await requireOwner(b.org, `proofmark:revoke:${b.org}:${b.label}`, b.ownerSig);
  if (!org) return c.json({ error: "owner signature required" }, 403);
  const key = store.get().keys.find((k) => k.org === org.name && k.label === b.label);
  if (!key) return c.json({ error: "unknown co-maintainer" }, 404);

  let tx: string | undefined;
  if (caps.ens && org.resolver) {
    try {
      const r = await ens.revokeCoMaintainer({ org: org.name, resolver: org.resolver as `0x${string}`, label: key.label, address: key.address as `0x${string}` });
      tx = r.revoke;
    } catch (e) {
      return c.json({ error: "ens-failed", message: (e as Error).message }, 502);
    }
  }
  store.update(() => {
    key.revoked = true;
    key.revokedAt = Date.now();
    key.ensTx = tx ?? key.ensTx;
  });
  logEvent({ kind: "revoked", detail: `${key.subname} revoked. Everything it signed goes blocked.`, tx: tx ? { chain: "sepolia", id: tx } : undefined });
  return c.json({ ok: true, subname: key.subname, tx: tx ?? null });
});

/** Show that a co-maintainer cannot write status or payto. An eth_call, no key needed. */
claimRoutes.post("/ens/unauthorized-demo", async (c) => {
  if (!caps.ens) return c.json({ error: "ENS is not configured" }, 503);
  const { org: orgName, label, key } = (await c.req.json()) as { org: string; label: string; key?: string };
  const org = store.get().orgs.find((o) => o.name === orgName);
  const k = store.get().keys.find((x) => x.org === orgName && x.label === label);
  if (!org?.resolver || !k) return c.json({ error: "unknown org or co-maintainer" }, 404);
  const r = await ens.unauthorizedWriteDemo({ resolver: org.resolver as `0x${string}`, org: org.name, from: k.address as `0x${string}`, key });
  return c.json(r);
});
