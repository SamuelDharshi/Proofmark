import { Hono } from "hono";
import { verifyMessage, getAddress } from "viem";
import { canonicalize, sha256, type AttestationPair } from "@proofmark/core";
import { caps } from "../config";
import { store, logEvent, uid, type AttestationRecord } from "../store";
import { evaluate, latestAttestation } from "../check";
import { agentPass, verifyAgentRequest, getAgentByEvm, budgetLeft } from "../agents";
import { paywall, paidRecently, priceFor } from "../x402";
import { buildPair, deriveAttestation, type Derived } from "../attest";
import { gatewaySigner, signPair } from "../sign";
import { anchor } from "../hcs";
import { privateKeyToAccount } from "viem/accounts";
import { env } from "../config";

export const attestRoutes = new Hono();

const deny = (c: any, status: 401 | 403, body: Record<string, unknown>) => c.json({ connected: false, ...body }, status);

/** Gateway countersignature over freshness: which buyer, when, and the tier at that moment. */
async function freshness(server: string, pairHash: string, buyer: string, tier: string) {
  const f = { server, pairHash, buyer, tier, checkedAt: Date.now(), validUntil: Date.now() + 24 * 60 * 60 * 1000 };
  if (!caps.signing) return { ...f, signature: null, signer: null };
  const acct = privateKeyToAccount(env.ATTEST_PRIVATE_KEY as `0x${string}`);
  return { ...f, signature: await acct.signMessage({ message: canonicalize(f) }), signer: acct.address };
}

/**
 * Gate before payment. The Agent Pass gates the authority to spend: if it is expired
 * or revoked the payment is refused and the connection never happens.
 */
attestRoutes.use("/", async (c, next) => {
  const server = c.req.query("server");
  if (!server) return c.json({ error: "server is required" }, 400);
  const evm = c.req.header("x-proofmark-agent-evm");
  const ts = c.req.header("x-proofmark-ts");
  const sig = c.req.header("x-proofmark-sig");
  if (!evm || !ts || !sig) return deny(c, 401, { reason: "agent-identity-required", message: "Sign the request with the agent wallet." });
  if (!(await verifyAgentRequest({ evm, ts, sig, server }))) return deny(c, 401, { reason: "bad-agent-signature", message: "Agent signature did not verify." });

  const agent = getAgentByEvm(evm);
  const pass = await agentPass(evm);
  if (!pass.valid) {
    logEvent({ kind: "denied", server, agent: agent?.ensName ?? evm, detail: `Payment refused: ${pass.message}` });
    return deny(c, 403, { reason: "pass-invalid", detail: pass.reason, message: pass.message, mode: pass.mode });
  }

  const check = await evaluate(server, c.req.query("version"));
  if (check.tier === "blocked") {
    logEvent({ kind: "blocked", server, agent: agent?.ensName ?? evm, detail: check.explain });
    return deny(c, 403, { reason: check.reason, tier: "blocked", message: check.explain });
  }
  if (check.tier === "sandboxed") {
    // Nobody to pay. Free answer, sandbox only.
    logEvent({ kind: "sandboxed", server, agent: agent?.ensName ?? evm, detail: "Unclaimed server, container only" });
    return c.json({ connected: true, tier: "sandboxed", free: true, check });
  }

  const { usd } = priceFor(server);
  if (agent && budgetLeft(agent) < usd) {
    logEvent({ kind: "denied", server, agent: agent.ensName, detail: "Payment refused: over budget" });
    return deny(c, 403, { reason: "budget-exceeded", message: `Budget on ${agent.ensName} is used up.` });
  }

  const att = latestAttestation(server, c.req.query("version"));
  if (agent && paidRecently(agent.hederaAccount, server) && att) {
    const pairHash = sha256(canonicalize(att.pair));
    return c.json({ connected: true, tier: "green", free: true, reason: "paid within 24h", attestation: att, check, freshness: await freshness(server, pairHash, agent.hederaAccount, "green") });
  }
  c.set("agentName" as never, (agent?.ensName ?? evm) as never);
  await next();
});

attestRoutes.use("/", paywall);

/** Reached only after x402 settled. */
attestRoutes.get("/", async (c) => {
  const server = c.req.query("server")!;
  const evm = c.req.header("x-proofmark-agent-evm")!;
  const agent = getAgentByEvm(evm);
  const check = await evaluate(server, c.req.query("version"));
  const att = latestAttestation(server, c.req.query("version"));
  if (!att) return c.json({ connected: false, reason: "unattested-version", check }, 404);
  const pairHash = sha256(canonicalize(att.pair));
  logEvent({ kind: "attest", server, agent: agent?.ensName, detail: `Attestation served, tier ${check.tier}` });
  return c.json({ connected: check.tier === "green", tier: check.tier, attestation: att, check, freshness: await freshness(server, pairHash, agent?.hederaAccount ?? "", check.tier) });
});

// ---- attestation worker ----
const pending = new Map<string, { derived: Derived; pair: AttestationPair; org: string }>();

/** Keys that may sign for an org, live or not. */
const orgKeys = (org: string) => store.get().keys.filter((k) => k.org === org);

function persistAttestation(derived: Derived, pair: AttestationPair, signature: string, signer: string) {
  return store.update((d) => {
    const rec: AttestationRecord = { pair, signature, signer, tools: derived.tools, createdAt: Date.now() };
    d.attestations.push(rec);
    return rec;
  });
}

attestRoutes.post("/run", async (c) => {
  const { server, version, label } = (await c.req.json()) as { server: string; version?: string; label: string };
  const claim = store.get().claims.find((x) => x.server === server);
  if (!claim) return c.json({ error: "server is not claimed" }, 400);
  const key = orgKeys(claim.org).find((k) => k.label === label);
  if (!key) return c.json({ error: "unknown co-maintainer" }, 400);
  if (key.revoked || key.expiresAt * 1000 < Date.now()) return c.json({ error: "that key is not live" }, 403);

  let derived: Derived;
  try {
    derived = await deriveAttestation(server, version);
  } catch (e) {
    return c.json({ error: (e as Error).message }, 422);
  }
  const pair = buildPair(derived, key.address, "gateway", key.subname);

  // Maintainer approval. If the gateway signing key is the registered key, it can sign directly.
  if (caps.signing && gatewaySigner().toLowerCase() === key.address.toLowerCase()) {
    const signed = await signPair(pair);
    const hcs = await anchor({ type: "attestation", server, version: pair.version, artifactHash: pair.artifactHash, toolManifestHash: pair.toolManifestHash, attestKey: pair.attestKey }).catch(() => null);
    const rec = persistAttestation(derived, pair, signed.signature, signed.signer);
    if (hcs) store.update(() => void (rec.hcs = hcs));
    logEvent({ kind: "attestation", server, detail: `Attested ${pair.version}, manifest ${pair.toolManifestHash.slice(0, 10)}…`, tx: hcs ? { chain: "hedera", id: hcs.tx } : undefined });
    return c.json({ status: "attested", attestation: rec });
  }
  const id = uid();
  pending.set(id, { derived, pair, org: claim.org });
  return c.json({ status: "pending-approval", id, signer: key.address, message: canonicalize(pair), pair, tools: derived.tools.map((t) => t.name) });
});

attestRoutes.post("/approve", async (c) => {
  const { id, signature } = (await c.req.json()) as { id: string; signature: `0x${string}` };
  const p = pending.get(id);
  if (!p) return c.json({ error: "unknown or expired request" }, 404);
  const ok = await verifyMessage({ address: getAddress(p.pair.attestKey), message: canonicalize(p.pair), signature }).catch(() => false);
  if (!ok) return c.json({ error: "signature does not match the registered attest.key" }, 403);
  const hcs = await anchor({ type: "attestation", server: p.pair.server, version: p.pair.version, artifactHash: p.pair.artifactHash, toolManifestHash: p.pair.toolManifestHash, attestKey: p.pair.attestKey }).catch(() => null);
  const rec = persistAttestation(p.derived, p.pair, signature, p.pair.attestKey);
  if (hcs) store.update(() => void (rec.hcs = hcs));
  pending.delete(id);
  logEvent({ kind: "attestation", server: p.pair.server, detail: `Approved ${p.pair.version}`, tx: hcs ? { chain: "hedera", id: hcs.tx } : undefined });
  return c.json({ status: "attested", attestation: rec });
});
