/**
 * Subscribes to the Hedera revocation topic through the mirror node. A revocation published there reaches a
 * running session in seconds. ENS stays the source of truth, and the proxy still re-reads it on a timer,
 * so a missed message only delays a block, it never allows one.
 */
export interface Revocation {
  org: string;
  subname: string;
  address: string;
  reason: string;
  sequence: number;
}

const MIRROR = "https://testnet.mirrornode.hedera.com/api/v1";

export function watchRevocations(o: {
  topic: string;
  matches: (r: Revocation) => boolean;
  onHit: (r: Revocation) => void;
  everyMs?: number;
  fetchImpl?: typeof fetch;
}): () => void {
  const f = o.fetchImpl ?? fetch;
  let after = `${Math.floor(Date.now() / 1000)}.000000000`;
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      const r = await f(`${MIRROR}/topics/${o.topic}/messages?order=asc&limit=25&timestamp=gt:${after}`, { signal: AbortSignal.timeout(8000) });
      if (r.ok) {
        const j = (await r.json()) as { messages: { sequence_number: number; consensus_timestamp: string; message: string }[] };
        for (const m of j.messages) {
          after = m.consensus_timestamp;
          let b: any;
          try {
            b = JSON.parse(Buffer.from(m.message, "base64").toString("utf8"));
          } catch {
            continue;
          }
          if (b?.type !== "revocation") continue;
          const rev: Revocation = { org: String(b.org), subname: String(b.subname), address: String(b.address ?? ""), reason: String(b.reason ?? "revoked"), sequence: m.sequence_number };
          if (o.matches(rev)) o.onHit(rev);
        }
      }
    } catch {}
  };
  const timer = setInterval(tick, o.everyMs ?? 5000);
  timer.unref?.();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
