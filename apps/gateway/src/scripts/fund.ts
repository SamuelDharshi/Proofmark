import { Hbar, TransferTransaction } from "@hiero-ledger/sdk";
import { env } from "../config";
import { hederaClient } from "../hcs";

/** Sends testnet HBAR from the gateway account. Usage: npm run fund -w @proofmark/gateway -- <account id> <hbar> */
const [to, hbarText] = process.argv.slice(2);
if (!to || !hbarText) throw new Error("usage: fund <account id> <hbar>");
const hbar = Number(hbarText);
if (!(hbar > 0 && hbar <= 200)) throw new Error("amount must be between 0 and 200 HBAR");
const client = hederaClient();
const tx = await new TransferTransaction().addHbarTransfer(env.HEDERA_GATEWAY_ACCOUNT_ID!, new Hbar(-hbar)).addHbarTransfer(to, new Hbar(hbar)).execute(client);
await tx.getReceipt(client);
const id = tx.transactionId.toString();
console.log(`sent ${hbar} HBAR from ${env.HEDERA_GATEWAY_ACCOUNT_ID} to ${to}`);
console.log(`https://hashscan.io/testnet/transaction/${id.replace("@", "-").replace(/\.(\d+)$/, "-$1")}`);
process.exit(0);
