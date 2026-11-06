import { caps, env } from "../config";
import { agentEns, readAgent, writeAgentTexts } from "../chain";
import { allowanceStatus, setAllowance } from "../allowance";

/**
 * Usage:
 *   npm run allowance -w @proofmark/gateway -- approve claude-1 5     approve a 5 HBAR allowance and record the operator on ENS
 *   npm run allowance -w @proofmark/gateway -- withdraw claude-1      set the allowance to zero
 *   npm run allowance -w @proofmark/gateway -- status claude-1
 */
if (!caps.hedera || !caps.ens) throw new Error("Hedera and ENS must be configured first");
const [action, label = "claude-1", amount] = process.argv.slice(2);
const name = agentEns(label);
const agent = await readAgent(name);
if (!agent) throw new Error(`${name} was not found on ENS`);
const link = (tx: string) => `https://hashscan.io/testnet/transaction/${tx.replace("@", "-").replace(/\.(\d+)$/, "-$1")}`;

if (action === "approve") {
  const hbar = Number(amount ?? 5);
  const tx = await setAllowance(agent.hedera, hbar);
  console.log(`approved ${hbar} HBAR from ${env.HEDERA_GATEWAY_ACCOUNT_ID} to ${agent.hedera}`);
  console.log(link(tx));
  if (agent.operator !== env.HEDERA_GATEWAY_ACCOUNT_ID) {
    const ensTx = await writeAgentTexts(label, { operator: env.HEDERA_GATEWAY_ACCOUNT_ID! });
    console.log(`operator recorded on ${name}: https://sepolia.etherscan.io/tx/${ensTx}`);
  }
} else if (action === "withdraw") {
  const tx = await setAllowance(agent.hedera, 0);
  console.log(`allowance for ${agent.hedera} set to 0`);
  console.log(link(tx));
}
await new Promise((r) => setTimeout(r, 6000)); // let the mirror node catch up before reading
console.log(JSON.stringify(await allowanceStatus((await readAgent(name))!, 0), null, 2));
process.exit(0);
