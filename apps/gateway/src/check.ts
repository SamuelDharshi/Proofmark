import { canonicalName } from "./registry";
import { decideTier, findTyposquat, type CheckResult } from "@proofmark/core";
import { store, type AttestationRecord } from "./store";
import { caps } from "./config";
import { readServerClaim, readOrg, readKey, type KeyRecord } from "./chain";

export const latestAttestation = (server: string, version?: string): AttestationRecord | undefined =>
  store
    .get()
    .attestations.filter((a) => a.pair.server === server && (!version || version === "latest" || a.pair.version === version))
    .sort((a, b) => b.createdAt - a.createdAt)[0];

export function divergence(server: string, version: string, attestedHash: string) {
  const reports = store.get().gossip.filter((g) => g.server === server && g.version === version && g.observedHash !== attestedHash);
  return { count: reports.length, clients: new Set(reports.map((r) => r.client)).size };
}

/**
 * Resolve any server name to a tier. Who claimed it, what the org charges and whether the signing
 * key is live are all read from ENS. An unclaimed name has no on-chain record, which is the
 * wildcard answer: sandboxed.
 */
export async function evaluate(input: string, version?: string): Promise<CheckResult & { key?: KeyRecord; divergent?: number }> {
  const server = await canonicalName(input);
  const base = { server, checkedAt: Date.now() };
  const claim = await readServerClaim(server).catch(() => null);

  if (!claim) {
    // Names the gateway has seen claimed are the reference set for the typosquat check.
    const squat = findTyposquat(server, store.get().claims.map((c) => c.server));
    const t = decideTier({ claimed: false, attested: false, artifactMatch: false, manifestMatch: false, keyLive: false, typosquatOf: squat });
    return { ...base, ...t, claimed: false };
  }

  const org = await readOrg(claim.org);
  const att = latestAttestation(server, version);
  const key = att?.pair.attestSubname ? await readKey(att.pair.attestSubname).catch(() => undefined) : undefined;
  // The key on the subname must be the one that signed this attestation.
  const keyMatches = !!key?.address && !!att && key.address.toLowerCase() === att.pair.attestKey.toLowerCase();
  const div = att ? divergence(server, att.pair.version, att.pair.toolManifestHash) : { count: 0, clients: 0 };

  const bond = org.bondStatus === "forfeited" ? "forfeited" : org.bondTx && org.bondStatus === "live" ? "live" : "missing";
  const t = decideTier({
    bond,
    domainVerified: !!org.domainVerified,
    layersRequired: caps.bond,
    claimed: true,
    attested: !!att,
    artifactMatch: true,
    manifestMatch: div.count === 0,
    keyLive: !!key?.live && keyMatches,
    keyExpired: key?.expired,
  });

  return {
    ...base,
    ...t,
    version: att?.pair.version,
    claimed: true,
    org: claim.org,
    payTo: org.payto ?? undefined,
    price: org.price ?? undefined,
    worldVerified: org.worldVerified,
    bond,
    bondTx: org.bondTx ?? undefined,
    domainVerified: org.domainVerified ?? undefined,
    attestKey: att?.pair.attestKey,
    artifactHash: att?.pair.artifactHash,
    toolManifestHash: att?.pair.toolManifestHash,
    tools: att?.tools,
    hcsTopic: att?.hcs?.topic,
    hcsSequence: att?.hcs?.sequence,
    nftToken: att?.nft?.tokenId,
    nftSerial: att?.nft?.serial,
    key,
    divergent: div.count,
  };
}
