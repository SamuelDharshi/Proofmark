export type Tier = "green" | "sandboxed" | "blocked";

export type BlockReason =
  | "hash-mismatch"
  | "manifest-mismatch"
  | "key-revoked"
  | "key-expired"
  | "typosquat"
  | "pass-invalid"
  | "budget-exceeded"
  | "unattested-version";

export interface TierInput {
  claimed: boolean;
  attested: boolean;
  artifactMatch: boolean;
  manifestMatch: boolean;
  keyLive: boolean;
  keyExpired?: boolean;
  typosquatOf?: string | null;
}

export interface TierResult {
  tier: Tier;
  reason: BlockReason | "claimed-and-verified" | "unclaimed";
  explain: string;
}

/** Three tiers only. No amber tier: pinning to an old version is a downgrade-by-silence attack. */
export function decideTier(i: TierInput): TierResult {
  if (i.typosquatOf)
    return { tier: "blocked", reason: "typosquat", explain: `Name is one or two edits from the claimed server "${i.typosquatOf}".` };
  if (!i.claimed) return { tier: "sandboxed", reason: "unclaimed", explain: "No verified human has claimed this server. It runs in a container with read-only tools." };
  if (!i.keyLive)
    return { tier: "blocked", reason: i.keyExpired ? "key-expired" : "key-revoked", explain: i.keyExpired ? "The attesting key has expired." : "The attesting key was revoked by the maintainer." };
  if (!i.attested) return { tier: "blocked", reason: "unattested-version", explain: "This version has no attestation. Only attested builds connect." };
  if (!i.artifactMatch) return { tier: "blocked", reason: "hash-mismatch", explain: "The artefact does not match the attested hash." };
  if (!i.manifestMatch) return { tier: "blocked", reason: "manifest-mismatch", explain: "The tools the server advertises differ from the attested tool manifest." };
  return { tier: "green", reason: "claimed-and-verified", explain: "Claimed by a verified human. Both hashes match and the key is live." };
}
