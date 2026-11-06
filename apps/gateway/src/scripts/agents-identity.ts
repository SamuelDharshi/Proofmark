import { env, caps } from "../config";
import { agentEns, readAgent, writeAgentIdentity } from "../chain";
import { anchor } from "../hcs";
import { registerErc8004, uaidFor } from "../identity";

/**
 * Gives an agent its two identities and writes both onto its ENS name:
 *   HCS-14 UAID (derived from its Hedera account) and an ERC-8004 registration on Sepolia.
 * Usage: npm run agents:identity -w @proofmark/gateway -- claude-1 [claude-2 ...]
 */
if (!caps.ens || !caps.hcs) throw new Error("ENS and HCS must be configured first");
const labels = process.argv.slice(2).length ? process.argv.slice(2) : [(env as any).AGENT_ENS_NAME?.split(".")[0] ?? process.env.AGENT_ENS_NAME?.split(".")[0] ?? "claude-1"];
for (const label of labels) {
  const name = agentEns(label);
  const a = await readAgent(name);
  if (!a) {
    console.log(`# ${name}: not found on ENS, skipped`);
    continue;
  }
  const { uaid } = uaidFor({ name, hederaAccount: a.hedera });
  let ref = a.erc8004;
  if (!ref) {
    const r = await registerErc8004({ ensName: name, uaid });
    ref = r.ref;
    console.log(`# ${name} ERC-8004 agentId ${r.agentId}`);
    console.log(`#   register  https://sepolia.etherscan.io/tx/${r.registerTx}`);
    console.log(`#   agentURI  https://sepolia.etherscan.io/tx/${r.uriTx}`);
  }
  const tx = await writeAgentIdentity(label, { uaid, erc8004: ref });
  const h = await anchor({ type: "agent-identity", standard: "HCS-14", ens: name, uaid, erc8004: ref, hedera: a.hedera });
  console.log(`# ${name}`);
  console.log(`#   UAID     ${uaid}`);
  console.log(`#   ENS      https://sepolia.etherscan.io/tx/${tx}`);
  if (h) console.log(`#   HCS #${h.sequence}  https://hashscan.io/testnet/topic/${h.topic}`);
}
process.exit(0);
