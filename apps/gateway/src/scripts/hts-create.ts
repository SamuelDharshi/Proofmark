import { caps } from "../config";
import { createAttestationCollection } from "../hts";

/** Creates the attestation NFT collection once. Usage: npm run hts:create -w @proofmark/gateway */
if (!caps.hedera) throw new Error("Set HEDERA_GATEWAY_ACCOUNT_ID and HEDERA_GATEWAY_PRIVATE_KEY first");
const r = await createAttestationCollection();
console.log(`\nHTS_TOKEN_ID=${r.tokenId}`);
console.log(`https://hashscan.io/testnet/token/${r.tokenId}`);
console.log(`https://hashscan.io/testnet/transaction/${r.tx.replace("@", "-").replace(/\.(\d+)$/, "-$1")}`);
process.exit(0);
