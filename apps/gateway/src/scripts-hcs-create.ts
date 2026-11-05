import { createTopic } from "./hcs";
const r = await createTopic();
console.log(`HCS_TOPIC_ID=${r.topicId}`);
console.log(`https://hashscan.io/testnet/topic/${r.topicId}`);
