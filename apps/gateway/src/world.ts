import { signRequest } from "@worldcoin/idkit-core/signing";
import { env, caps } from "./config";
import { store } from "./store";

export function worldStatus() {
  return { configured: caps.world, environment: env.WORLD_ENVIRONMENT, action: env.WORLD_ACTION, appId: env.WORLD_APP_ID ?? null, rpId: env.WORLD_RP_ID ?? null };
}

/** RP signature is generated on the backend only. The signing key never leaves it. */
export function rpSignature(action = env.WORLD_ACTION) {
  if (!caps.world) throw new Error("World is not configured");
  const raw = (env.WORLD_RP_SIGNING_KEY ?? "").trim().replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(raw))
    throw new Error(
      `WORLD_RP_SIGNING_KEY must be the 32-byte signing key (64 hex characters) from the World developer portal, not an address. The configured value is ${raw.length / 2} bytes.`,
    );
  const { sig, nonce, createdAt, expiresAt } = signRequest({ signingKeyHex: raw, action });
  return { sig, nonce, created_at: createdAt, expires_at: expiresAt, rp_id: env.WORLD_RP_ID!, app_id: env.WORLD_APP_ID!, action, environment: env.WORLD_ENVIRONMENT };
}

/** First nullifier found anywhere in the IDKit result. */
function findNullifier(v: unknown): string | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.nullifier === "string") return o.nullifier;
  if (typeof o.nullifier_hash === "string") return o.nullifier_hash;
  for (const x of Object.values(o)) {
    const r = findNullifier(x);
    if (r) return r;
  }
  return null;
}

const toDecimal = (hex: string) => BigInt(hex).toString(10);

export type ProofResult =
  | { ok: true; nullifier: string }
  | { ok: false; reason: "not-configured" | "wrong-environment" | "invalid-proof" | "no-nullifier" | "duplicate"; message: string; nullifier?: string };

/**
 * Verify a Proof of Human on the backend. The client result is never trusted:
 * it is forwarded to the Developer Portal and the nullifier is checked for reuse.
 */
export async function verifyHumanProof(idkitResponse: any, action = env.WORLD_ACTION): Promise<ProofResult> {
  if (!caps.world) return { ok: false, reason: "not-configured", message: "World verification is not configured on this gateway." };
  if (idkitResponse?.environment !== env.WORLD_ENVIRONMENT)
    return { ok: false, reason: "wrong-environment", message: `Proof environment must be ${env.WORLD_ENVIRONMENT}.` };

  const r = await fetch(`https://developer.world.org/api/v4/verify/${env.WORLD_RP_ID}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...idkitResponse, environment: env.WORLD_ENVIRONMENT }),
  });
  const body = (await r.json().catch(() => ({}))) as { success?: boolean; environment?: string; code?: string; detail?: string; attribute?: string; results?: { code?: string; detail?: string; attribute?: string }[] };
  if (!r.ok || body.success !== true || body.environment !== env.WORLD_ENVIRONMENT) {
    // Pass World's own reason through, so a wrong action, a spent verification limit or a bad signer is not a mystery.
    const why = [body.code ?? body.results?.[0]?.code, body.detail ?? body.results?.[0]?.detail, body.attribute ?? body.results?.[0]?.attribute].filter(Boolean).join(": ");
    console.warn(`[world] verify rejected (${r.status}): ${JSON.stringify(body).slice(0, 400)}`);
    return { ok: false, reason: "invalid-proof", message: `World could not verify this proof${why ? ` (${why})` : ` (HTTP ${r.status})`}.` };
  }

  const hex = findNullifier(idkitResponse);
  if (!hex) return { ok: false, reason: "no-nullifier", message: "Proof carried no nullifier." };
  const nullifier = toDecimal(hex);

  const used = store.get().nullifiers.find((n) => n.nullifier === nullifier && n.action === action);
  if (used) return { ok: false, reason: "duplicate", nullifier, message: "This person has already claimed a server. One human, one identity." };
  return { ok: true, nullifier };
}

export function recordNullifier(nullifier: string, org: string, action = env.WORLD_ACTION) {
  store.update((d) => {
    d.nullifiers.push({ nullifier, action, org, ts: Date.now() });
  });
}

/** The nullifier carried by an IDKit result, read locally with no network call. */
export function proofNullifier(idkitResponse: unknown): string | null {
  const hex = findNullifier(idkitResponse);
  try {
    return hex ? toDecimal(hex) : null;
  } catch {
    return null;
  }
}
