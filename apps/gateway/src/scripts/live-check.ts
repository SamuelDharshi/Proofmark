import { createPublicClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { env } from "../config";
import { readServerClaim, readOrg, readAgent, orgNameOwner, serverEns } from "../chain";
import { orgName } from "../ens";
import { ERC8004_IDENTITY } from "../identity";

/**
 * Checks the deployed system against the chains, not against itself.
 * Usage: npm run live:check -w @proofmark/gateway [gateway-url]
 */
const G = process.argv[2] ?? "https://proofmark-gateway.onrender.com";
const MIRROR = "https://testnet.mirrornode.hedera.com/api/v1";
let failed = 0;
const row = (ok: boolean, name: string, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  ${detail}` : ""}`);
};
const j = async (url: string, init?: RequestInit) => {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(90_000) });
  return { status: r.status, body: (await r.json().catch(() => ({}))) as any };
};

console.log(`Gateway ${G}\n`);

// ---- gateway
const health = await j(`${G}/health`);
row(health.status === 200 && health.body.ok, "gateway is up");
const cfg = (await j(`${G}/config`)).body;
row(cfg.caps?.hedera && cfg.caps?.hcs && cfg.caps?.ens && cfg.caps?.world, "gateway has Hedera, HCS, ENS and World configured");
row(!!cfg.agentPass?.configured, "World Agent Pass client is configured", cfg.agentPass?.issuer);
row(cfg.network === "hedera:testnet" && cfg.facilitator?.includes("blocky402"), "x402 settles on Hedera testnet through Blocky402");

// ---- Hedera: topic, token, settled payment
const topic = cfg.hedera?.topic as string;
const msgs = await j(`${MIRROR}/topics/${topic}/messages?limit=100&order=desc`);
const decoded = (msgs.body.messages ?? []).map((m: any) => { try { return JSON.parse(Buffer.from(m.message, "base64").toString()); } catch { return null; } }).filter(Boolean);
row(decoded.length > 0, "HCS topic has messages on the mirror node", `${decoded.length} read, types: ${[...new Set(decoded.map((d: any) => d.type))].join(", ")}`);
row(decoded.some((d: any) => d.type === "agent-identity" && d.standard === "HCS-14"), "an HCS-14 agent identity is anchored on HCS");
const pay = decoded.find((d: any) => d.type === "payment");
if (pay) {
  const tx = await j(`${MIRROR}/transactions/${pay.txId.replace("@", "-").replace(/\.(\d+)$/, "-$1")}`);
  const t = tx.body.transactions?.[0];
  row(t?.result === "SUCCESS", "the x402 payment on HCS is a SUCCESS transaction on the mirror node", pay.txId);
}
if (env.HTS_TOKEN_ID) {
  const tok = await j(`${MIRROR}/tokens/${env.HTS_TOKEN_ID}`);
  row(tok.body.type === "NON_FUNGIBLE_UNIQUE" && tok.body.symbol === "PMARK", "HTS attestation collection exists", `${env.HTS_TOKEN_ID} supply ${tok.body.total_supply}`);
}

// ---- ENS on Sepolia
const owner = await orgNameOwner("samuel").catch(() => null);
row(!!owner, "org samuel.proofmark.eth is registered in ENSv2", owner ?? "");
const org = await readOrg(orgName("samuel")).catch(() => null);
row(org?.status === "claimed" && !!org.payto && org.worldVerified, "org records are on-chain and World-verified", JSON.stringify({ payto: org?.payto, price: org?.price }));

const agentEns = (env as any).AGENT_ENS_NAME ?? process.env.AGENT_ENS_NAME ?? "claude-1.agents.proofmark.eth";
const agent = await readAgent(agentEns).catch(() => null);
row(!!agent?.evm && !!agent.hedera, `agent ${agentEns} is read from ENS`, agent?.hedera);
row(!!agent?.uaid?.startsWith("uaid:aid:"), "agent has an HCS-14 UAID on its ENS name");

const pc = createPublicClient({ chain: sepolia, transport: http(env.SEPOLIA_RPC_URL) });
if (agent?.erc8004) {
  const [, , , id] = agent.erc8004.split(":");
  const reg = parseAbi(["function ownerOf(uint256) view returns (address)", "function tokenURI(uint256) view returns (string)"]);
  const ownerOf = await pc.readContract({ address: ERC8004_IDENTITY, abi: reg, functionName: "ownerOf", args: [BigInt(id)] }).catch(() => null);
  const uri = await pc.readContract({ address: ERC8004_IDENTITY, abi: reg, functionName: "tokenURI", args: [BigInt(id)] }).catch(() => "");
  const file = uri.startsWith("data:") ? JSON.parse(Buffer.from(uri.split(",")[1], "base64").toString()) : null;
  row(!!ownerOf && file?.name === agentEns && file?.registrations?.[0]?.agentId === Number(id), "agent is registered in the ERC-8004 Identity Registry", `agentId ${id}`);
}

// ---- gateway decisions come from chain
const unclaimed = (await j(`${G}/check?server=ai.adeu/adeu`)).body;
row(unclaimed.tier === "sandboxed" && unclaimed.reason === "unclaimed", "an unclaimed registry server is sandboxed");
const mine = process.env.CHECK_SERVER;
if (mine) {
  const claim = await readServerClaim(mine);
  const gw = (await j(`${G}/check?server=${encodeURIComponent(mine)}`)).body;
  row(!!claim === (gw.claimed === true), `gateway and chain agree on whether ${mine} is claimed`, `${serverEns(mine)} chain=${!!claim} gateway=${gw.claimed}`);
}
const reg = await j(`${G}/check?server=io.github.arben-adm/mcp-sequential-thinking`);
row(reg.body.claimed === false, "someone else's server is not claimed by this org");

// ---- denied path: a signed agent request with no World Agent Pass is refused before any payment
if (process.env.AGENT_HEDERA_PRIVATE_KEY && agent) {
  const acct = privateKeyToAccount(`0x${process.env.AGENT_HEDERA_PRIVATE_KEY.replace(/^0x/, "")}`);
  const server = "ai.adeu/adeu";
  const ts = String(Date.now());
  const sig = await acct.signMessage({ message: `proofmark-connect:${server}:${ts}` });
  const r = await j(`${G}/attest?server=${encodeURIComponent(server)}`, { headers: { "x-proofmark-agent": agentEns, "x-proofmark-ts": ts, "x-proofmark-sig": sig } });
  const unbound = r.status === 403 && r.body.reason === "pass-invalid";
  row(unbound || r.status === 200, "agent request is gated by the World Agent Pass before any payment", `HTTP ${r.status} ${r.body.reason ?? r.body.tier ?? ""}`);
  const bad = await j(`${G}/attest?server=${encodeURIComponent(server)}`, { headers: { "x-proofmark-agent": agentEns, "x-proofmark-ts": ts, "x-proofmark-sig": "0x" + "00".repeat(65) } });
  row(bad.status === 401, "a forged agent signature is refused", `HTTP ${bad.status}`);
}

console.log(`\n${failed === 0 ? "All checks passed" : `${failed} check(s) failed`}`);
process.exit(failed === 0 ? 0 : 1);
