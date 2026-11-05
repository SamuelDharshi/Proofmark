import { decideTier, findTyposquat, type CheckResult } from "@thanks/core";
import { caps } from "./config";
import { store, type AttestationRecord, type MaintainerKey, type Org } from "./store";
import * as ens from "./ens";

export interface KeyState {
  live: boolean;
  expired: boolean;
  source: "ens" | "store";
}

/** Live key state. Reads ENS when configured, otherwise the gateway store. */
export async function keyState(key: MaintainerKey, org: Org): Promise<KeyState> {
  if (caps.ens && key.ensTx && key.registry) {
    try {
      const k = await ens.keyLive(org.name, key.label, key.address, key.registry as `0x${string}`);
      return { live: k.live, expired: k.expired, source: "ens" };
    } catch {
      /* fall through to the store */
    }
  }
  const expired = key.expiresAt * 1000 < Date.now();
  return { live: !key.revoked && !expired, expired, source: "store" };
}

export const latestAttestation = (server: string, version?: string): AttestationRecord | undefined =>
  store
    .get()
    .attestations.filter((a) => a.pair.server === server && (!version || version === "latest" || a.pair.version === version))
    .sort((a, b) => b.createdAt - a.createdAt)[0];

export function divergence(server: string, version: string, attestedHash: string) {
  const reports = store.get().gossip.filter((g) => g.server === server && g.version === version && g.observedHash !== attestedHash);
  return { count: reports.length, clients: new Set(reports.map((r) => r.client)).size };
}

/** Resolve any server name to a tier. Unclaimed names resolve to sandboxed, the same as a wildcard. */
export async function evaluate(server: string, version?: string): Promise<CheckResult & { keyState?: KeyState; divergent?: number }> {
  const db = store.get();
  const claim = db.claims.find((c) => c.server === server);
  const claimedNames = db.claims.map((c) => c.server);
  const squat = !claim ? findTyposquat(server, claimedNames) : null;
  const base = { server, checkedAt: Date.now() };

  if (!claim) {
    const t = decideTier({ claimed: false, attested: false, artifactMatch: false, manifestMatch: false, keyLive: false, typosquatOf: squat });
    return { ...base, ...t, claimed: false };
  }

  const org = db.orgs.find((o) => o.name === claim.org)!;
  const att = latestAttestation(server, version);
  const key = att && db.keys.find((k) => k.address.toLowerCase() === att.pair.attestKey.toLowerCase() && k.org === org.name);
  const ks = key ? await keyState(key, org) : undefined;
  const div = att ? divergence(server, att.pair.version, att.pair.toolManifestHash) : { count: 0, clients: 0 };

  const t = decideTier({
    claimed: true,
    attested: !!att,
    artifactMatch: true,
    manifestMatch: div.count === 0,
    keyLive: !!ks?.live,
    keyExpired: ks?.expired,
  });

  return {
    ...base,
    ...t,
    version: att?.pair.version,
    claimed: true,
    org: org.ensName,
    payTo: org.payTo,
    price: org.price,
    worldVerified: org.worldVerified,
    attestKey: att?.pair.attestKey,
    artifactHash: att?.pair.artifactHash,
    toolManifestHash: att?.pair.toolManifestHash,
    tools: att?.tools,
    hcsTopic: att?.hcs?.topic,
    hcsSequence: att?.hcs?.sequence,
    keyState: ks,
    divergent: div.count,
  };
}
