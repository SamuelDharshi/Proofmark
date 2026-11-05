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

export async function createTopic(memo = "THANKS attestation and payment log") {
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
