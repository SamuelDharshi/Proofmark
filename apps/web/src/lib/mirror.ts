/** Public Hedera testnet data, read in the browser straight from the mirror node. */
export const MIRROR = "https://testnet.mirrornode.hedera.com/api/v1";
export const HASHSCAN = "https://hashscan.io/testnet";
export const HTS_COLLECTION = "0.0.11341242";
export const AUDIT_TOPIC = "0.0.11331506";
export const REVOKE_TOPIC = "0.0.11344888";

export async function mirror(path: string) {
  const r = await fetch(`${MIRROR}${path}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`mirror node ${r.status}`);
  return r.json();
}

export function decodeMessage(b64: string) {
  try {
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))));
  } catch {
    return null;
  }
}

/** Live totals for the landing page: HCS messages, certificates minted and the latest payment. */
export async function hederaTotals() {
  const [audit, revoke, nfts] = await Promise.all([
    mirror(`/topics/${AUDIT_TOPIC}/messages?limit=1&order=desc`),
    mirror(`/topics/${REVOKE_TOPIC}/messages?limit=1&order=desc`),
    mirror(`/tokens/${HTS_COLLECTION}/nfts?limit=100`),
  ]);
  return {
    hcs: (audit.messages?.[0]?.sequence_number ?? 0) + (revoke.messages?.[0]?.sequence_number ?? 0),
    certificates: nfts.nfts?.length ?? 0,
  };
}
