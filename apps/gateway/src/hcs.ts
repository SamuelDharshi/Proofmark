import { Client, PrivateKey, TopicCreateTransaction, TopicMessageSubmitTransaction } from "@hiero-ledger/sdk";
import { env, caps } from "./config";

let client: Client | null = null;
function hedera() {
  if (!caps.hedera) throw new Error("Hedera gateway account is not configured");
  if (!client) {
    client = Client.forTestnet();
    client.setOperator(env.HEDERA_GATEWAY_ACCOUNT_ID!, PrivateKey.fromStringECDSA(env.HEDERA_GATEWAY_PRIVATE_KEY!));
  }
  return client;
}

export async function createTopic(memo = "Proofmark attestation and payment log") {
  const tx = await new TopicCreateTransaction().setTopicMemo(memo).execute(hedera());
  const receipt = await tx.getReceipt(hedera());
  return { topicId: receipt.topicId!.toString(), tx: tx.transactionId.toString() };
}

export interface HcsRecord {
  topic: string;
  sequence: number;
  tx: string;
}

/** Anchor one message. Each attestation and each payment is one message. */
export async function anchor(message: Record<string, unknown>): Promise<HcsRecord | null> {
  if (!caps.hcs) return null;
  const tx = await new TopicMessageSubmitTransaction()
    .setTopicId(env.HCS_TOPIC_ID!)
    .setMessage(JSON.stringify({ v: 1, ...message }))
    .execute(hedera());
  const receipt = await tx.getReceipt(hedera());
  return { topic: env.HCS_TOPIC_ID!, sequence: Number(receipt.topicSequenceNumber), tx: tx.transactionId.toString() };
}

/** Read the public replayable log back from the mirror node. */
export async function readLog(limit = 25) {
  if (!env.HCS_TOPIC_ID) return [];
  const r = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/topics/${env.HCS_TOPIC_ID}/messages?limit=${limit}&order=desc`);
  if (!r.ok) return [];
  const j = (await r.json()) as { messages: { sequence_number: number; consensus_timestamp: string; message: string }[] };
  return j.messages.map((m) => {
    let body: unknown = null;
    try {
      body = JSON.parse(Buffer.from(m.message, "base64").toString("utf8"));
    } catch {}
    return { sequence: m.sequence_number, consensusTimestamp: m.consensus_timestamp, body };
  });
}

export interface PaymentMsg { buyer: string; server: string; usd: number; ts: number; txId: string }

let payCache: { t: number; v: PaymentMsg[] } | null = null;

/** Every payment message on the public HCS topic, newest first. The log is the record. */
export async function paymentMessages(): Promise<PaymentMsg[]> {
  if (payCache && Date.now() - payCache.t < 10_000) return payCache.v;
  if (!env.HCS_TOPIC_ID) return [];
  const out: PaymentMsg[] = [];
  let url: string | null = `https://testnet.mirrornode.hedera.com/api/v1/topics/${env.HCS_TOPIC_ID}/messages?limit=100&order=desc`;
  for (let page = 0; page < 10 && url; page++) {
    const r: Response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!r.ok) break;
    const j = (await r.json()) as { messages: { message: string }[]; links?: { next?: string | null } };
    for (const m of j.messages) {
      try {
        const b = JSON.parse(Buffer.from(m.message, "base64").toString("utf8"));
        if (b.type === "payment") out.push({ buyer: b.buyer, server: b.server, usd: Number(b.usd) || 0, ts: Number(b.ts) || 0, txId: b.txId });
      } catch {}
    }
    url = j.links?.next ? `https://testnet.mirrornode.hedera.com${j.links.next}` : null;
  }
  payCache = { t: Date.now(), v: out };
  return out;
}

/** What an agent has spent in total. A budget cannot be reset by editing a local file. */
export async function spentUsd(hederaAccount: string): Promise<number> {
  const all = await paymentMessages();
  return +all.filter((p) => p.buyer === hederaAccount).reduce((n, p) => n + p.usd, 0).toFixed(6);
}

/** True when this buyer already paid for this server inside the 24 hour validity window. */
export async function paidRecently(hederaAccount: string, server: string) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return (await paymentMessages()).some((p) => p.buyer === hederaAccount && p.server === server && p.ts > cutoff);
}

export const invalidateSpent = (_account?: string) => void (payCache = null);
