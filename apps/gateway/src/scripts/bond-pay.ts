import { AccountId, Client, Hbar, PrivateKey, TransferTransaction } from "@hiero-ledger/sdk";
import { env } from "../config";

/**
 * Pays a maintainer bond from an org's payout account. Run it on your own machine: the private key never leaves it.
 *
 *   npm run bond:pay -w @proofmark/gateway -- <payout account id> <private key> [hbar]
 *
 * The key is a Hedera DER or raw hex key. ED25519 and ECDSA accounts are both accepted.
 * It prints the transaction id to paste into the claim page.
 */
const [from, keyText, hbarText] = process.argv.slice(2);
if (!from || !keyText) throw new Error("usage: bond:pay <payout account id> <private key> [hbar]");
if (!env.BOND_ACCOUNT_ID) throw new Error("BOND_ACCOUNT_ID is not set");
const hbar = Number(hbarText ?? env.BOND_MIN_HBAR);

const parse = (k: string) => {
  try {
    return PrivateKey.fromStringDer(k);
  } catch {
    try {
      return PrivateKey.fromStringED25519(k);
    } catch {
      return PrivateKey.fromStringECDSA(k);
    }
  }
};

const client = Client.forTestnet().setOperator(AccountId.fromString(from), parse(keyText));
const tx = await new TransferTransaction().addHbarTransfer(from, new Hbar(-hbar)).addHbarTransfer(env.BOND_ACCOUNT_ID, new Hbar(hbar)).execute(client);
await tx.getReceipt(client);
const id = tx.transactionId.toString();
console.log(`bonded ${hbar} HBAR from ${from} to ${env.BOND_ACCOUNT_ID}`);
console.log(`transaction id: ${id}`);
console.log(`https://hashscan.io/testnet/transaction/${id.replace("@", "-").replace(/\.(\d+)$/, "-$1")}`);
process.exit(0);
