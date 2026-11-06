import { createHash } from "node:crypto";
import { parseAbi, parseEventLogs, type Hex } from "viem";
import { publicClient, send } from "./ens";

/** ERC-8004 Identity Registry on Ethereum Sepolia, from the erc-8004-contracts README. */
export const ERC8004_IDENTITY = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const;
export const SEPOLIA = 11155111;
export const agentRegistryId = `eip155:${SEPOLIA}:${ERC8004_IDENTITY}`;

const abi = parseAbi([
  "function register(string agentURI) returns (uint256 agentId)",
  "function setAgentURI(uint256 agentId, string newURI)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
]);

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58(buf: Buffer): string {
  let n = BigInt("0x" + buf.toString("hex"));
  let out = "";
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of buf) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}

/**
 * HCS-14 Universal Agent ID, `uaid:aid`. The id is the Base58 SHA-384 of the canonical agent JSON
 * (keys sorted, fields registry, name, version, protocol, nativeId, skills), and the parameters
 * follow in the order the standard fixes: uid, registry, proto, nativeId.
 */
export function uaidFor(p: { name: string; hederaAccount: string }) {
  const nativeId = `hedera:testnet:${p.hederaAccount}`;
  const canonical = JSON.stringify({ name: p.name, nativeId, protocol: "x402", registry: "proofmark", skills: [], version: "1" });
  const id = base58(createHash("sha384").update(canonical).digest());
  return { uaid: `uaid:aid:${id};uid=0;registry=proofmark;proto=x402;nativeId=${nativeId}`, canonical };
}

const dataUri = (o: unknown) => `data:application/json;base64,${Buffer.from(JSON.stringify(o)).toString("base64")}`;

function registrationFile(p: { ensName: string; uaid: string; agentId?: bigint }) {
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: p.ensName,
    description: "A Proofmark agent. It pays x402 on Hedera before connecting to an MCP server and is identified by its ENS name and an HCS-14 UAID.",
    services: [
      { name: "ENS", endpoint: p.ensName, version: "v1" },
      { name: "DID", endpoint: p.uaid, version: "HCS-14" },
    ],
    x402Support: true,
    active: true,
    registrations: p.agentId === undefined ? [] : [{ agentId: Number(p.agentId), agentRegistry: agentRegistryId }],
    supportedTrust: ["reputation"],
  };
}

/** Registers the agent in the ERC-8004 Identity Registry, then writes the registration file back with its own agentId. */
export async function registerErc8004(p: { ensName: string; uaid: string }) {
  const regTx = await send(ERC8004_IDENTITY, abi as any, "register", [dataUri(registrationFile(p))]);
  const receipt = await publicClient().getTransactionReceipt({ hash: regTx });
  const ev = parseEventLogs({ abi, logs: receipt.logs, eventName: "Registered" })[0];
  if (!ev) throw new Error("Registered event not found");
  const agentId = ev.args.agentId;
  const uriTx = await send(ERC8004_IDENTITY, abi as any, "setAgentURI", [agentId, dataUri(registrationFile({ ...p, agentId }))]);
  return { agentId, registerTx: regTx as Hex, uriTx: uriTx as Hex, ref: `${agentRegistryId}:${agentId}` };
}
