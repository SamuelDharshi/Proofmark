import { AccountCreateTransaction, Client, Hbar, PrivateKey } from "@hiero-ledger/sdk";
import { privateKeyToAccount } from "viem/accounts";
import { env, caps } from "../config";
import { store } from "../store";
import { registerAgent, agentEns } from "../chain";

/**
 * Creates N funded Hedera testnet accounts and registers each as an agent namespace on ENS,
 * <label>.agents.<root>, with its wallet, budget and risk ceiling as records. Nothing is kept locally
 * except the list of names.
 * Usage: npm run agents:create -w @proofmark/gateway -- 3 [hbar-each] [budget-usd]
 */
if (!caps.hedera) throw new Error("Set HEDERA_GATEWAY_ACCOUNT_ID and HEDERA_GATEWAY_PRIVATE_KEY first");
if (!caps.ens) throw new Error("Set SEPOLIA_RPC_URL and ENS_ADMIN_PRIVATE_KEY first");
const n = Number(process.argv[2] ?? 3);
const hbar = Number(process.argv[3] ?? 5);
const budget = Number(process.argv[4] ?? 1);
const client = Client.forTestnet().setOperator(env.HEDERA_GATEWAY_ACCOUNT_ID!, PrivateKey.fromStringECDSA(env.HEDERA_GATEWAY_PRIVATE_KEY!));

const existing = store.get().agents.length;
for (let i = 1; i <= n; i++) {
  const label = `claude-${existing + i}`;
  const key = PrivateKey.generateECDSA();
  const tx = await new AccountCreateTransaction().setKeyWithoutAlias(key.publicKey).setInitialBalance(new Hbar(hbar)).execute(client);
  const accountId = (await tx.getReceipt(client)).accountId!.toString();
  const evm = privateKeyToAccount(`0x${key.toStringRaw()}`).address;
  const reg = await registerAgent({ label, hedera: accountId, evm, budgetUsd: budget, maxRisk: "green", allowedTools: [] });
  store.update((d) => void d.agents.push({ ensName: reg.name, addedAt: Date.now() }));
  console.log(`\n# ${reg.name}   https://hashscan.io/testnet/account/${accountId}`);
  for (const t of reg.txs) console.log(`#   ${t.label.padEnd(14)} https://sepolia.etherscan.io/tx/${t.hash}`);
  console.log(`AGENT_HEDERA_ACCOUNT_ID=${accountId}`);
  console.log(`AGENT_HEDERA_PRIVATE_KEY=${key.toStringRaw()}`);
  console.log(`AGENT_ENS_NAME=${agentEns(label)}`);
}
process.exit(0);
