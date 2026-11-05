import { AccountCreateTransaction, Client, Hbar, PrivateKey } from "@hiero-ledger/sdk";
import { privateKeyToAccount } from "viem/accounts";
import { env, caps } from "../config";

/**
 * Creates N funded Hedera testnet accounts from the gateway account and registers each as an agent.
 * Usage: npm run agents:create -w @proofmark/gateway -- 3 [hbar-each]
 */
if (!caps.hedera) throw new Error("Set HEDERA_GATEWAY_ACCOUNT_ID and HEDERA_GATEWAY_PRIVATE_KEY first");
const n = Number(process.argv[2] ?? 3);
const hbar = Number(process.argv[3] ?? 5);
const client = Client.forTestnet().setOperator(env.HEDERA_GATEWAY_ACCOUNT_ID!, PrivateKey.fromStringECDSA(env.HEDERA_GATEWAY_PRIVATE_KEY!));

for (let i = 1; i <= n; i++) {
  const key = PrivateKey.generateECDSA();
  const tx = await new AccountCreateTransaction().setKeyWithoutAlias(key.publicKey).setInitialBalance(new Hbar(hbar)).execute(client);
  const accountId = (await tx.getReceipt(client)).accountId!.toString();
  const evm = privateKeyToAccount(`0x${key.toStringRaw()}`).address;
  const ensName = `claude-${i}.${env.ENS_ROOT_NAME.replace(/^[^.]+\./, "") || "team.eth"}`;
  await fetch(`${env.PUBLIC_GATEWAY_URL}/agents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ensName, evmAddress: evm, hederaAccount: accountId, budgetUsd: 1, maxRisk: "green" }),
  }).catch(() => console.warn("gateway not running, agent not registered"));
  console.log(`\n# ${ensName}  https://hashscan.io/testnet/account/${accountId}`);
  console.log(`AGENT_HEDERA_ACCOUNT_ID=${accountId}`);
  console.log(`AGENT_HEDERA_PRIVATE_KEY=${key.toStringRaw()}`);
  console.log(`AGENT_ENS_NAME=${ensName}`);
  console.log(`# EVM address for AgentBook: ${evm}`);
}
process.exit(0);
