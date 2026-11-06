import { Hono } from "hono";
import { verifyMessage, getAddress, isAddress } from "viem";
import { caps, env } from "../config";
import { store, logEvent, uid } from "../store";
import { getServer, verifyNameOwnership } from "../registry";
import { rpSignature, verifyHumanProof, recordNullifier, proofNullifier, worldStatus } from "../world";
import * as ens from "../ens";
import { verifyControl, namespaceOf } from "../control";
import { bondInfo, verifyBond } from "../bond";
import { anchor, anchorTo } from "../hcs";
import { orgInfra, orgNameOwner, readOrg, readKey, readServerClaim, registerServer, writeOrgTexts } from "../chain";

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
  const { server, owner } = (await c.req.json()) as { server: string; owner?: string };
  if (!server) return c.json({ error: "server is required" }, 400);
  const existing = await readServerClaim(server).catch(() => null);
  if (existing) {
    // Already on ENS. Tell the owner where to go instead of failing.
    const label = existing.org.split(".")[0];
    const chainOwner = await orgNameOwner(label).catch(() => null);
    const yours = !!owner && !!chainOwner && chainOwner.toLowerCase() === owner.toLowerCase();
    return c.json({
      ok: false,
      method: "claimed",
      claimed: { org: label, ens: existing.org.includes(".") ? existing.org : `${label}.${env.ENS_ROOT_NAME}`, owner: chainOwner, yours },
      detail: yours ? `You already own this server, as ${label}. Continue on the Maintain page.` : `Already claimed on ENS by ${label}.`,
    });
  }
  const o = await ownership(server).catch((e) => ({ ok: false, method: "error", detail: (e as Error).message }));
  const meta = await getServer(server).catch(() => null);
  const base = { title: meta?.title ?? meta?.name, version: meta?.version, description: meta?.description };
  if (!o.ok) return c.json({ ...o, ...base });
  // The registry listing is real, but that does not say who is asking. The claimer must prove control of the namespace.
  if (!owner || !isAddress(owner)) return c.json({ ok: false, method: "wallet", detail: "Connect your wallet first. It is bound to the proof.", needsWallet: true, ...base });
  const control = await verifyControl(server, getAddress(owner));
  return c.json({ ok: control.ok, method: control.ok ? `${o.method} + ${control.method}` : control.method, detail: control.ok ? control.detail : `${control.detail}.`, control, ...base });
});

/**
 * The ENS writes take about a minute (several Sepolia transactions), far too long for one HTTP request
 * on a hosted gateway. The claim is validated here, then runs as a job the page polls.
 */
interface Job {
  id: string;
  status: "running" | "done" | "failed";
  step: string;
  txs: { label: string; hash: string }[];
  error?: string;
  result?: unknown;
}
const jobs = new Map<string, Job>();

claimRoutes.get("/claim/job/:id", (c) => {
  const j = jobs.get(c.req.param("id"));
  return j ? c.json(j) : c.json({ error: "unknown job. If the gateway restarted, submit the claim again: it resumes where it stopped." }, 404);
});

/** Steps 2 to 4: Proof of Human, then the one-time ENS writes. */
claimRoutes.post("/claim", async (c) => {
  if (!caps.ens) return c.json({ error: "ens-not-configured", message: "ENS is not configured on this gateway." }, 503);
  const b = (await c.req.json()) as { server: string; org: string; owner: string; payTo: string; price?: number; idkitResponse: unknown };
  if (!b.server || !slug(b.org ?? "") || !isAddress(b.owner ?? "") || !/^\d+\.\d+\.\d+$/.test(b.payTo ?? ""))
    return c.json({ error: "server, org (a-z, 0-9, -), owner address and Hedera payTo account are required" }, 400);
  const owner = getAddress(b.owner);

  if (await readServerClaim(b.server)) return c.json({ error: "already-claimed", message: "This server is already claimed on ENS." }, 409);

  // An org whose earlier attempt stopped part-way may be resumed, but only by the wallet that owns its name on-chain.
  const existing = await orgInfra(b.org);
  let needsRecords = false;
  if (existing) {
    const chainOwner = await orgNameOwner(b.org);
    if (chainOwner?.toLowerCase() !== owner.toLowerCase()) return c.json({ error: "org-taken", message: "That org name is owned by someone else." }, 409);
    needsRecords = !(await readOrg(ens.orgName(b.org))).owner;
  }

  const own = await ownership(b.server).catch(() => ({ ok: false, method: "error", detail: "registry lookup failed" }));
  if (!own.ok) return c.json({ error: "ownership-failed", ...own }, 403);
  const control = await verifyControl(b.server, owner);
  if (!control.ok) return c.json({ error: "control-not-proven", message: `${control.detail}. Publish ${control.where}: ${control.challenge}`, ...control }, 403);

  // Validate on the backend. The client result is never trusted. A proof already accepted for this same org
  // (an earlier attempt that did not finish) is not sent to World a second time.
  const seen = proofNullifier(b.idkitResponse);
  const prior = seen ? store.get().nullifiers.find((n) => n.nullifier === seen && n.action === env.WORLD_ACTION && n.org === b.org) : undefined;
  let nullifier: string;
  if (prior) {
    nullifier = prior.nullifier;
  } else {
    const proof = await verifyHumanProof(b.idkitResponse);
    if (!proof.ok) {
      logEvent({ kind: "claim-rejected", server: b.server, detail: proof.message });
      return c.json({ error: proof.reason, message: proof.message }, proof.reason === "duplicate" ? 409 : proof.reason === "not-configured" ? 503 : 400);
    }
    nullifier = proof.nullifier;
    recordNullifier(nullifier, b.org);
  }

  const price = Math.min(b.price ?? env.CONNECT_PRICE_USD, env.MAX_PRICE_USD);
  const expiresAt = Math.floor(Date.now() / 1000) + 365 * DAY;
  const job: Job = { id: uid(), status: "running", step: "Starting", txs: [] };
  jobs.set(job.id, job);

  void (async () => {
    try {
      if (!existing) {
        const chain = await ens.registerOrg({ org: b.org, owner, payTo: b.payTo, price, worldVerified: true, expiresAt, onStep: (s) => (job.step = s) });
        job.txs.push(...chain.txs);
        ens.watchResolver(chain.resolver);
      } else if (needsRecords) {
        job.step = "Finishing the org records";
        const hash = await ens.writeOrgRecords({ org: b.org, resolver: existing.resolver, owner, payTo: b.payTo, price, worldVerified: true });
        job.txs.push({ label: "records", hash });
      }
      job.step = "Claiming the server name on ENS";
      const srv = await registerServer({ server: b.server, org: b.org, owner, expiresAt });
      job.txs.push(...srv.txs);
      job.step = "Recording the verified namespace";
      job.txs.push({ label: "namespace", hash: await writeOrgTexts(b.org, { "domain.verified": `${control.method}: ${namespaceOf(b.server)}` }) });

      // Display index only. The decisions are made from ENS.
      store.update((d) => {
        if (!d.orgs.some((o) => o.name === b.org)) d.orgs.push({ name: b.org, ensName: ens.orgName(b.org), owner, payTo: b.payTo, price, worldVerified: true, nullifier, createdAt: Date.now() });
        d.claims.push({ server: b.server, org: b.org, claimedAt: Date.now(), ownershipProof: `${own.method}: ${own.detail}` });
      });
      logEvent({ kind: "claim", server: b.server, detail: `${b.server} claimed by ${ens.orgName(b.org)}`, tx: { chain: "sepolia", id: job.txs.at(-1)!.hash } });
      job.result = { ok: true, org: { name: b.org, ensName: ens.orgName(b.org), ensTx: job.txs.at(-1)?.hash }, txs: job.txs };
      job.status = "done";
      job.step = "Claimed";
    } catch (e) {
      job.status = "failed";
      job.error = (e as Error).message;
      job.step = "Stopped. Submit the claim again to resume.";
    }
  })();

  return c.json({ jobId: job.id }, 202);
});

// ---- the bond ----
claimRoutes.get("/bond", (c) => c.json(bondInfo()));

/** Record a bond deposit. The owner signs, the mirror node proves the transfer, ENS and HCS keep the record. */
claimRoutes.post("/bond", async (c) => {
  if (!caps.ens || !env.BOND_ACCOUNT_ID) return c.json({ error: "bond-not-configured", message: "This gateway has no bond account." }, 503);
  const b = (await c.req.json()) as { org: string; txId: string; ownerSig: string };
  const org = await requireOwner(b.org, `proofmark:bond:${b.org}:${b.txId}`, b.ownerSig);
  if (!org) return c.json({ error: "owner signature required" }, 403);
  if (!org.payto) return c.json({ error: "the org has no payout account on ENS" }, 409);
  const v = await verifyBond(b.txId, org.payto);
  if (!v.ok) return c.json({ error: "bond-rejected", message: v.detail }, 400);
  try {
    const ensTx = await writeOrgTexts(b.org, { "bond.tx": v.txId!, "bond.status": "live" });
    const hcs = await anchor({ type: "bond", org: b.org, txId: v.txId, hbar: v.hbar, from: org.payto, to: env.BOND_ACCOUNT_ID, status: "live" }).catch(() => null);
    logEvent({ kind: "bond", detail: `${ens.orgName(b.org)} bonded ${v.hbar} HBAR`, tx: { chain: "sepolia", id: ensTx } });
    return c.json({ ok: true, hbar: v.hbar, txId: v.txId, ensTx, hcs });
  } catch (e) {
    return c.json({ error: "ens-failed", message: (e as Error).message }, 502);
  }
});

/** Forfeit a bond after a malicious release. Only the ENS admin wallet may do this, and it is logged on HCS. */
claimRoutes.post("/bond/forfeit", async (c) => {
  if (!caps.ens) return c.json({ error: "ens-not-configured" }, 503);
  const b = (await c.req.json()) as { org: string; reason: string; adminSig: string };
  const message = `proofmark:forfeit:${b.org}:${b.reason}`;
  if (!(await verifyMessage({ address: getAddress(ens.adminAddress()), message, signature: b.adminSig as `0x${string}` }).catch(() => false))) return c.json({ error: "admin signature required" }, 403);
  const org = await readOrg(ens.orgName(b.org));
  if (!org.bondTx) return c.json({ error: "this org has no bond" }, 409);
  const ensTx = await writeOrgTexts(b.org, { "bond.status": "forfeited" });
  const hcs = await anchor({ type: "bond-forfeit", org: b.org, txId: org.bondTx, reason: b.reason.slice(0, 120), status: "forfeited" }).catch(() => null);
  logEvent({ kind: "bond", detail: `${ens.orgName(b.org)} bond forfeited: ${b.reason}`, tx: { chain: "sepolia", id: ensTx } });
  return c.json({ ok: true, ensTx, hcs });
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
  const b = (await c.req.json()) as { org: string; label: string; ownerSig: string; reason?: string };
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
  // ENS stays the source of truth. The topic makes the news reach every running proxy in seconds.
  const hcs = env.REVOKE_TOPIC_ID
    ? await anchorTo(env.REVOKE_TOPIC_ID, { type: "revocation", org: b.org, label: b.label, subname: r.subname, address: key.address, reason: (b.reason ?? "revoked by the maintainer").slice(0, 120), ensTx: r.revoke, ts: Date.now() }).catch(() => null)
    : null;
  logEvent({ kind: "revoked", detail: `${r.subname} revoked. Everything it signed goes blocked.`, tx: { chain: "sepolia", id: r.revoke } });
  return c.json({ ok: true, subname: r.subname, tx: r.revoke, hcs });
});

/** Show that a co-maintainer cannot write status or payto. An eth_call, no key needed. */
claimRoutes.post("/ens/unauthorized-write", async (c) => {
  if (!caps.ens) return c.json({ error: "ENS is not configured" }, 503);
  const { org, label, key } = (await c.req.json()) as { org: string; label: string; key?: string };
  const infra = await orgInfra(org);
  const k = await readKey(`${label}.${ens.orgName(org)}`);
  if (!infra || !k.address) return c.json({ error: "unknown org or co-maintainer" }, 404);
  return c.json(await ens.unauthorizedWriteDemo({ resolver: infra.resolver, org, from: k.address as `0x${string}`, key }));
});
