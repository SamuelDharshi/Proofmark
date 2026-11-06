import { AccountCreateTransaction, Client, Hbar, KeyList, PrivateKey } from "@hiero-ledger/sdk";
import { env, caps } from "../config";

/**
 * Creates the bond account as a 2-of-2 account: the gateway key and a second key. Neither key alone can move the
 * funds. Usage: npm run bond:create -w @proofmark/gateway
 */
if (!caps.hedera) throw new Error("Set HEDERA_GATEWAY_ACCOUNT_ID and HEDERA_GATEWAY_PRIVATE_KEY first");
const gw = PrivateKey.fromStringECDSA(env.HEDERA_GATEWAY_PRIVATE_KEY!);
const second = PrivateKey.generateECDSA();
const client = Client.forTestnet().setOperator(env.HEDERA_GATEWAY_ACCOUNT_ID!, gw);
const tx = await new AccountCreateTransaction()
  .setKeyWithoutAlias(new KeyList([gw.publicKey, second.publicKey], 2))
  .setInitialBalance(new Hbar(1))
  .setAccountMemo("Proofmark maintainer bonds, 2-of-2")
  .execute(client);
const id = (await tx.getReceipt(client)).accountId!.toString();
console.log(`BOND_ACCOUNT_ID=${id}`);
console.log(`BOND_ACCOUNT_KEY2=${second.toStringRaw()}   # keep this private, it is the second key`);
console.log(`https://hashscan.io/testnet/account/${id}`);
process.exit(0);
