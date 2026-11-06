import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { verifyMessage } from "viem";
import { canonicalize, diffManifests, toolManifestHash, type McpTool, type ManifestDiff } from "@proofmark/core";
import { containerSpec, dockerAvailable, openStdio, type Session, type SpawnSpec } from "@proofmark/runner";
import { decodePaymentResponseHeader } from "@x402/fetch";
import type { Identity } from "./identity";

export interface ConnectOptions {
  gateway: string;
  server: string;
  version?: string;
  launch?: SpawnSpec;
  /** Local artefact to hash and compare with the attested artefact hash. */
  artifactPath?: string;
}

export type Refusal = {
  ok: false;
  reason: string;
  message: string;
  diff?: ManifestDiff;
  payment?: { tx: string };
};
export type Connected = {
  ok: true;
  tier: "green" | "sandboxed";
  session: Session;
  tools: McpTool[];
  attested: { manifestHash: string; tools: McpTool[]; version: string; attestKey?: string; attestSubname?: string };
  payment?: { tx: string; payer?: string };
  free: boolean;
  artifactVerified: boolean;
};
export type Decision = Refusal | Connected;

/** Compare a file with the attested hash in the format the registry publishes it: npm sha512 integrity, or sha256 hex. */
function digestMatches(path: string, expected: string): { ok: boolean; actual: string } {
  const bytes = readFileSync(path);
  if (expected.startsWith("sha512-")) {
    const actual = "sha512-" + createHash("sha512").update(bytes).digest("base64");
    return { ok: actual === expected, actual };
  }
  const actual = "0x" + createHash("sha256").update(bytes).digest("hex");
  const want = "0x" + expected.replace(/^(0x|sha256:)/i, "").toLowerCase();
  return { ok: actual === want, actual };
}

/** The agent's allowed.tools record on ENS. Empty means every tool. */
const allowed = (tools: McpTool[], list?: string[]) => (list && list.length ? tools.filter((t) => list.includes(t.name)) : tools);

const describeDiff = (d: ManifestDiff) => {
  const parts: string[] = [];
  if (d.added.length) parts.push(`now advertises ${d.added.join(", ")}, which it did not have when it was attested`);
  if (d.changed.length) parts.push(`changed ${d.changed.map((c) => `${c.name} (${c.fields.join(" and ")})`).join(", ")}`);
  if (d.removed.length) parts.push(`dropped ${d.removed.join(", ")}`);
  return parts.join("; ");
};

/** Resolve, pay, verify both hashes, spawn, and compare the manifest the server actually sent. */
export async function connect(id: Identity, o: ConnectOptions): Promise<Decision> {
  const ts = String(Date.now());
  const sig = await id.sign(`proofmark-connect:${o.server}:${ts}`);
  const url = `${o.gateway}/attest?server=${encodeURIComponent(o.server)}${o.version ? `&version=${encodeURIComponent(o.version)}` : ""}`;

  const res = await id.payFetch(url, {
    headers: { "x-proofmark-agent-evm": id.evmAddress, "x-proofmark-agent": id.ensName, "x-proofmark-ts": ts, "x-proofmark-sig": sig },
  });

  let payment: { tx: string; payer?: string } | undefined;
  const h = res.headers.get("payment-response") ?? res.headers.get("x-payment-response");
  if (h) {
    try {
      const s = decodePaymentResponseHeader(h) as { transaction?: string; payer?: string };
      if (s.transaction) payment = { tx: s.transaction, payer: s.payer };
    } catch {}
  }

  const body = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    if (res.status === 402) return { ok: false, reason: "payment-failed", message: "The x402 payment could not be completed.", payment };
    return { ok: false, reason: body.reason ?? `http-${res.status}`, message: body.message ?? body.error ?? "Refused by the gateway.", payment };
  }

  if (body.tier === "sandboxed") return sandboxed(o, body);

  const att = body.attestation;
  const pair = att?.pair;
  if (!pair) return { ok: false, reason: "unattested-version", message: "No attestation for this server.", payment };
  if (pair.server !== o.server) return { ok: false, reason: "wrong-server", message: "Attestation is for a different server.", payment };

  // The maintainer key must have signed exactly this pair.
  const signedOk = await verifyMessage({ address: pair.attestKey, message: canonicalize(pair), signature: att.signature }).catch(() => false);
  if (!signedOk) return { ok: false, reason: "bad-signature", message: "Attestation signature does not match the maintainer key.", payment };
  if (body.freshness?.validUntil && body.freshness.validUntil < Date.now()) return { ok: false, reason: "stale", message: "Attestation freshness window has passed.", payment };

  // Artefact hash: what we are about to run must be what was attested.
  let artifactVerified = false;
  if (o.artifactPath) {
    const m = digestMatches(o.artifactPath, String(pair.artifactHash));
    if (!m.ok) return { ok: false, reason: "hash-mismatch", message: `Artefact hash ${m.actual.slice(0, 14)}… does not match the attested ${String(pair.artifactHash).slice(0, 14)}….`, payment };
    artifactVerified = true;
  } else if (pair.registryType === "oci") {
    // An OCI image is pinned by digest, so the launch command must name exactly the attested digest.
    const want = String(pair.artifactHash).replace(/^0x/, "");
    if (!o.launch?.args.some((a) => a.includes(want))) return { ok: false, reason: "artifact-unverified", message: "The launch command must pin the attested image digest.", payment };
    artifactVerified = true;
  } else if (pair.registryType === "local") {
    return { ok: false, reason: "artifact-unverified", message: "Pass --artifact so the build can be hashed. Refusing to run an unverified local build.", payment };
  }

  if (!o.launch) return { ok: false, reason: "no-launch", message: "No launch command given.", payment };
  const session = await openStdio(o.launch).catch((e) => {
    throw new Error(`could not start the server: ${(e as Error).message}`);
  });

  // The manifest the server actually sent, hashed by us.
  const observed = toolManifestHash(session.tools);
  if (observed !== pair.toolManifestHash) {
    const diff = diffManifests(att.tools ?? [], session.tools);
    await session.close().catch(() => {});
    return { ok: false, reason: "manifest-mismatch", message: `Refused before the model saw the tool list. The server ${describeDiff(diff) || "advertises a different tool manifest"}.`, diff, payment };
  }

  return { ok: true, tier: "green", session, tools: allowed(session.tools, body.policy?.allowedTools), attested: { manifestHash: pair.toolManifestHash, tools: att.tools ?? [], version: pair.version, attestKey: pair.attestKey, attestSubname: pair.attestSubname }, payment, free: !!body.free, artifactVerified };
}

/** Unclaimed servers run in a container we control, with read-only tools only. */
async function sandboxed(o: ConnectOptions, body: any): Promise<Decision> {
  if (!dockerAvailable())
    return { ok: false, reason: "no-container-runtime", message: "This server is unclaimed and no container runtime is available, so it is not launched locally." };
  const image = o.launch?.args?.find((a) => a.includes("/") || a.includes(":")) ?? "";
  if (!image) return { ok: false, reason: "not-containerisable", message: "Only OCI servers can be sandboxed. This one is not launched locally." };
  const session = await openStdio(containerSpec(image));
  const readOnly = session.tools.filter((t) => (t as any).annotations?.readOnlyHint === true);
  return { ok: true, tier: "sandboxed", session, tools: readOnly, attested: { manifestHash: "", tools: [], version: body.check?.version ?? "unattested" }, free: true, artifactVerified: false };
}
