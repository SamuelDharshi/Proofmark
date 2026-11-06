import { createTopic } from "../hcs";

/** Usage: npm run hcs:create -w @proofmark/gateway [revocations] */
const kind = process.argv[2];
const r = await createTopic(kind === "revocations" ? "Proofmark revocations" : undefined);
console.log(`${kind === "revocations" ? "REVOKE_TOPIC_ID" : "HCS_TOPIC_ID"}=${r.topicId}`);
console.log(`https://hashscan.io/testnet/topic/${r.topicId}`);
// The Hedera client keeps sockets open, so end the script explicitly.
process.exit(0);
