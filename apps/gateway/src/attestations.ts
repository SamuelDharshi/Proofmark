import { getAddress, verifyMessage } from "viem";
import { canonicalize, type AttestationPair, type McpTool } from "@proofmark/core";
import { caps, env } from "./config";
import { store, logEvent, type AttestationRecord } from "./store";
import { anchor, topicMessages } from "./hcs";
import { mintAttestation } from "./hts";

/**
 * An attestation is recorded in three places: the signed record on the HCS topic (which is the durable copy),
 * an HTS NFT certificate, and this gateway's local index. The local index is a cache. It is rebuilt from HCS,
 * so a gateway that restarts, or a second gateway, sees the same attestations and trusts none of them blindly:
 * each one is re-verified against its signature, and the key must still be live on ENS when it is used.
 */
const fits = (o: object) => Buffer.byteLength(JSON.stringify(o)) <= 1000;

export async function recordAttestation(p: { pair: AttestationPair; signature: `0x${string}`; tools: McpTool[] }): Promise<AttestationRecord> {
  const { pair, signature, tools } = p;
  const base = {
    type: "attestation",
    server: pair.server,
    version: pair.version,
    artifactHash: pair.artifactHash,
    toolManifestHash: pair.toolManifestHash,
    attestKey: pair.attestKey,
    subname: pair.attestSubname,
    rt: pair.registryType,
    rc: pair.revocationCheckedAt,
    vu: pair.validUntil,
    sig: signature,
  };
  const withTools = { ...base, tn: tools.map((t) => t.name) };
  const hcs = await anchor(fits(withTools) ? withTools : base).catch(() => null);
  const nft = await mintAttestation({ server: pair.server, version: pair.version, manifestHash: pair.toolManifestHash }).catch(() => null);
  const rec: AttestationRecord = { pair, signature, signer: pair.attestKey, tools, createdAt: Date.now(), hcs: hcs ?? undefined, nft: nft ?? undefined };
  store.update((d) => void d.attestations.push(rec));
  logEvent({ kind: "attestation", server: pair.server, detail: `Attested ${pair.version}, signed by ${pair.attestSubname}`, tx: hcs ? { chain: "hedera", id: hcs.tx } : undefined });
  return rec;
}

let last = 0;
/** Rebuild the local index from the HCS topic. Messages without a valid signature are ignored. */
export async function syncAttestationsFromHcs(force = false): Promise<number> {
  if (!caps.hcs || !env.HCS_TOPIC_ID) return 0;
  if (!force && Date.now() - last < 20_000) return 0;
  last = Date.now();
  let added = 0;
  for (const m of await topicMessages(env.HCS_TOPIC_ID, 300).catch(() => [])) {
    const b = m.body;
    if (b?.type !== "attestation" || !b.sig || !b.attestKey || !b.rt) continue;
    if (store.get().attestations.some((a) => a.hcs?.sequence === m.sequence || (a.signature === b.sig))) continue;
    const pair: AttestationPair = {
      server: b.server,
      version: b.version,
      registryType: b.rt,
      artifactHash: b.artifactHash,
      toolManifestHash: b.toolManifestHash,
      attestKey: b.attestKey,
      attestSubname: b.subname,
      revocationCheckedAt: b.rc,
      buyer: "gateway",
      validUntil: b.vu,
    };
    const ok = await verifyMessage({ address: getAddress(pair.attestKey), message: canonicalize(pair), signature: b.sig }).catch(() => false);
    if (!ok) continue;
    const tools: McpTool[] = ((b.tn as string[] | undefined) ?? []).map((name) => ({ name, description: "", inputSchema: { type: "object" } }));
    const rec: AttestationRecord = { pair, signature: b.sig, signer: pair.attestKey, tools, createdAt: Math.floor(Number(m.consensusTimestamp) * 1000), hcs: { topic: env.HCS_TOPIC_ID, sequence: m.sequence, tx: "" } };
    store.update((d) => void d.attestations.push(rec));
    added++;
  }
  return added;
}
