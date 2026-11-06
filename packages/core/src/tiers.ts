export type Tier = "green" | "sandboxed" | "blocked";

export type BlockReason =
  | "hash-mismatch"
  | "manifest-mismatch"
  | "key-revoked"
  | "key-expired"
  | "typosquat"
  | "pass-invalid"
  | "budget-exceeded"
  | "unattested-version"
  | "bond-forfeited";

export interface TierInput {
  claimed: boolean;
  attested: boolean;
  artifactMatch: boolean;
  manifestMatch: boolean;
  keyLive: boolean;
  keyExpired?: boolean;
  typosquatOf?: string | null;
  /** The maintainer bond on Hedera. A forfeited bond blocks. A missing one keeps a server out of green. */
  bond?: "live" | "missing" | "forfeited";
  /** The registry namespace is proven to belong to the claimer (GitHub account or domain). */
  domainVerified?: boolean;
  /** True when this gateway runs with a bond account, so green needs a live bond and a verified namespace. */
  layersRequired?: boolean;
}

export interface TierResult {
  tier: Tier;
  reason: BlockReason | "claimed-and-verified" | "unclaimed" | "layers-incomplete";
  explain: string;
}

/** Three tiers only. No amber tier: pinning to an old version is a downgrade-by-silence attack. */
export function decideTier(i: TierInput): TierResult {
  if (i.typosquatOf)
    return { tier: "blocked", reason: "typosquat", explain: `Name is one or two edits from the claimed server "${i.typosquatOf}".` };
  if (!i.claimed) return { tier: "sandboxed", reason: "unclaimed", explain: "No maintainer has claimed this server. It runs in a container with read-only tools." };
  if (i.bond === "forfeited")
    return { tier: "blocked", reason: "bond-forfeited", explain: "The maintainer's bond was forfeited after a malicious release." };
  if (!i.keyLive)
    return { tier: "blocked", reason: i.keyExpired ? "key-expired" : "key-revoked", explain: i.keyExpired ? "The attesting key has expired." : "The attesting key was revoked by the maintainer." };
  if (!i.attested) return { tier: "blocked", reason: "unattested-version", explain: "This version has no attestation. Only attested builds connect." };
  if (!i.artifactMatch) return { tier: "blocked", reason: "hash-mismatch", explain: "The artefact does not match the attested hash." };
  if (!i.manifestMatch) return { tier: "blocked", reason: "manifest-mismatch", explain: "The tools the server advertises differ from the attested tool manifest." };
  if (i.layersRequired) {
    const missing = [i.bond !== "live" ? "a live bond" : "", i.domainVerified ? "" : "a verified namespace"].filter(Boolean);
    if (missing.length)
      return { tier: "sandboxed", reason: "layers-incomplete", explain: `Claimed and attested, but it still needs ${missing.join(" and ")}. It runs in a container with read-only tools.` };
  }
  return { tier: "green", reason: "claimed-and-verified", explain: "Claimed by a unique, domain-verified, bonded maintainer. Both hashes match and the key is live." };
}
