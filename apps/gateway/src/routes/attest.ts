import { Hono } from "hono";
import { verifyMessage, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { canonicalize, sha256, toolManifestHash, type AttestationPair, type McpTool } from "@proofmark/core";
import { orgName as orgNameOf } from "../ens";
import { caps, env } from "../config";
import { store, logEvent, uid, type AttestationRecord } from "../store";
import { evaluate, latestAttestation } from "../check";
import { loadAgent, passStatus, budgetLeft, verifyAgentRequest } from "../agents";
import { paywall, priceFor } from "../x402";
import { buildPair, deriveAttestation, registryArtifactHash, type Derived } from "../attest";
import { recordAttestation, syncAttestationsFromHcs } from "../attestations";
import { anchor, paidRecently } from "../hcs";
import { readServerClaim, readKey } from "../chain";

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
 * Gate before payment. The agent is an ENS namespace: its wallet, budget, risk ceiling and Agent Pass
 * are read from <agent>.agents.<root>. If the pass is missing or expired, or the budget is spent, the
 * payment is refused and the connection never happens.
 */
attestRoutes.use("/", async (c, next) => {
  const server = c.req.query("server");
  if (!server) return c.json({ error: "server is required" }, 400);
  const name = c.req.header("x-proofmark-agent");
  const ts = c.req.header("x-proofmark-ts");
  const sig = c.req.header("x-proofmark-sig");
  if (!name || !ts || !sig) return deny(c, 401, { reason: "agent-identity-required", message: "Name the agent and sign the request with its wallet." });

  const agent = await loadAgent(name).catch(() => null);
  if (!agent) return deny(c, 401, { reason: "unknown-agent", message: `${name} has no agent record on ENS.` });
  if (!(await verifyAgentRequest({ evm: agent.evm, ts, sig, server }))) return deny(c, 401, { reason: "bad-agent-signature", message: `The signature is not from the wallet recorded on ${name}.` });

  const pass = passStatus(agent);
  if (!pass.valid) {
    logEvent({ kind: "denied", server, agent: name, detail: `Payment refused: ${pass.message}` });
    return deny(c, 403, { reason: "pass-invalid", detail: pass.reason, message: pass.message, expiresAt: pass.expiresAt });
  }

  const check = await evaluate(server, c.req.query("version"));
  if (check.tier === "blocked") {
    logEvent({ kind: "blocked", server, agent: name, detail: check.explain });
    return deny(c, 403, { reason: check.reason, tier: "blocked", message: check.explain });
  }
  if (check.tier === "sandboxed") {
    if (agent.maxRisk === "green") {
      logEvent({ kind: "denied", server, agent: name, detail: "Policy: this agent only connects to green servers" });
      return deny(c, 403, { reason: "risk-ceiling", tier: "sandboxed", message: `${name} is limited to green servers by its maxrisk record.` });
    }
    // Nobody to pay. Free answer, container only.
    logEvent({ kind: "sandboxed", server, agent: name, detail: "Unclaimed server, container only" });
    return c.json({ connected: true, tier: "sandboxed", free: true, check, policy: { allowedTools: agent.allowedTools } });
  }

  const { usd } = await priceFor(server);
  const left = await budgetLeft(agent);
  if (left < usd) {
    logEvent({ kind: "denied", server, agent: name, detail: `Payment refused: budget left $${left}, price $${usd}` });
    return deny(c, 403, { reason: "budget-exceeded", message: `${name} has $${left} left of its budget.` });
  }

  const att = latestAttestation(server, c.req.query("version"));
  if (att && (await paidRecently(agent.hedera, server))) {
    const pairHash = sha256(canonicalize(att.pair));
    return c.json({
      connected: true, tier: "green", free: true, reason: "paid within 24h", attestation: att, check,
      policy: { allowedTools: agent.allowedTools }, freshness: await freshness(server, pairHash, agent.hedera, "green"),
    });
  }
  await next();
});

attestRoutes.use("/", paywall);

/** Reached only after x402 settled. */
attestRoutes.get("/", async (c) => {
  const server = c.req.query("server")!;
  const agent = await loadAgent(c.req.header("x-proofmark-agent")!);
  const check = await evaluate(server, c.req.query("version"));
  const att = latestAttestation(server, c.req.query("version"));
  if (!att) return c.json({ connected: false, reason: "unattested-version", check }, 404);
  const pairHash = sha256(canonicalize(att.pair));
  logEvent({ kind: "attest", server, agent: agent?.ensName, detail: `Attestation served, tier ${check.tier}` });
  return c.json({
    connected: check.tier === "green", tier: check.tier, attestation: att, check,
    policy: { allowedTools: agent?.allowedTools ?? [] }, freshness: await freshness(server, pairHash, agent?.hedera ?? "", check.tier),
  });
});

// ---- attestation worker ----
const pending = new Map<string, { derived: Derived; pair: AttestationPair }>();

/**
 * Derive the manifest from the pinned artefact and prepare the pair. The key recorded on the
 * co-maintainer's ENS subname must sign it. The worker never signs on a maintainer's behalf.
 */
attestRoutes.post("/run", async (c) => {
  const { server, version, label } = (await c.req.json()) as { server: string; version?: string; label: string };
  const claim = await readServerClaim(server);
  if (!claim) return c.json({ error: "this server is not claimed on-chain" }, 400);
  const subname = `${label}.${claim.org}`;
  const key = await readKey(subname);
  if (!key.live || !key.address) return c.json({ error: `${subname} has no live attest.key`, expired: key.expired }, 403);

  let derived: Derived;
  try {
    derived = await deriveAttestation(server, version);
  } catch (e) {
    return c.json({ error: (e as Error).message }, 422);
  }
  const pair = buildPair(derived, key.address, "gateway", subname);
  const id = uid();
  pending.set(id, { derived, pair });
  return c.json({ status: "pending-approval", id, signer: key.address, subname, message: canonicalize(pair), pair, tools: derived.tools.map((t) => t.name) });
});

/** The maintainer's key signs. The signature is checked against the key recorded on ENS, then anchored on HCS. */
attestRoutes.post("/approve", async (c) => {
  const { id, signature } = (await c.req.json()) as { id: string; signature: `0x${string}` };
  const p = pending.get(id);
  if (!p) return c.json({ error: "unknown or expired request" }, 404);
  const key = await readKey(p.pair.attestSubname!);
  if (!key.live || key.address?.toLowerCase() !== p.pair.attestKey.toLowerCase()) return c.json({ error: "that key is no longer live on ENS" }, 403);
  const ok = await verifyMessage({ address: getAddress(p.pair.attestKey), message: canonicalize(p.pair), signature }).catch(() => false);
  if (!ok) return c.json({ error: "signature does not match the attest.key recorded on ENS" }, 403);

  const rec = await recordAttestation({ pair: p.pair, signature, tools: p.derived.tools });
  pending.delete(id);
  return c.json({ status: "attested", attestation: rec });
});

/**
 * Publish an attestation derived elsewhere, for example on a laptop with Docker. Render cannot run containers,
 * so the derivation happens at the maintainer's side. The gateway does not take the manifest on trust:
 * the artefact hash is recomputed from the registry, the manifest hash must match the tool list, the signature
 * must be from the key recorded on ENS, and that key must be live.
 */
attestRoutes.post("/submit", async (c) => {
  const b = (await c.req.json()) as { pair: AttestationPair; signature: `0x${string}`; tools: McpTool[] };
  const pair = b.pair;
  if (!pair?.server || !pair.attestSubname || !b.signature || !Array.isArray(b.tools)) return c.json({ error: "pair, signature and tools are required" }, 400);

  const claim = await readServerClaim(pair.server);
  if (!claim) return c.json({ error: "this server is not claimed on ENS" }, 403);
  if (!pair.attestSubname.endsWith(`.${orgNameOf(claim.org)}`)) return c.json({ error: "the signing key does not belong to the org that claimed this server" }, 403);
  const key = await readKey(pair.attestSubname);
  if (!key.live || key.address?.toLowerCase() !== pair.attestKey.toLowerCase()) return c.json({ error: "that key is not live on ENS" }, 403);
  if (!(await verifyMessage({ address: getAddress(pair.attestKey), message: canonicalize(pair), signature: b.signature }).catch(() => false))) return c.json({ error: "signature does not match the attest.key recorded on ENS" }, 403);

  const reg = await registryArtifactHash(pair.server, pair.version).catch((e) => ({ error: (e as Error).message }));
  if ("error" in reg) return c.json({ error: reg.error }, 502);
  if (reg.hash !== pair.artifactHash) return c.json({ error: "artefact hash does not match what the registry publishes for this version" }, 409);
  if (toolManifestHash(b.tools) !== pair.toolManifestHash) return c.json({ error: "tool manifest hash does not match the submitted tool list" }, 409);

  const rec = await recordAttestation({ pair, signature: b.signature, tools: b.tools });
  await syncAttestationsFromHcs(true).catch(() => {});
  return c.json({ status: "attested", attestation: rec });
});
