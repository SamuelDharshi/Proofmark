import { privateKeyToAccount } from "viem/accounts";
import { canonicalize } from "@proofmark/core";
import { dockerAvailable } from "@proofmark/runner";
import { env } from "../config";
import * as ens from "../ens";
import { orgInfra, readKey, readServerClaim } from "../chain";
import { buildPair, deriveAttestation } from "../attest";

/**
 * The Maintain page, from a terminal: add a co-maintainer key, derive the tool manifest in a sandbox,
 * sign it with that key and submit it to the gateway, which re-checks everything before it records it.
 *   npm run maintain -w @proofmark/gateway -- <org> <server> [label] [days] [gateway]
 */
const [org = "sam", server = "io.github.SamuelDharshi/proofmark-files", label = "main", days = "180", G = "https://proofmark-gateway.onrender.com"] = process.argv.slice(2);
const eth = (h: string) => `https://sepolia.etherscan.io/tx/${h}`;

if (!env.ATTEST_PRIVATE_KEY) throw new Error("ATTEST_PRIVATE_KEY is not set");
const signer = privateKeyToAccount(env.ATTEST_PRIVATE_KEY as `0x${string}`);
const sub = `${label}.${ens.orgName(org)}`;

const claim = await readServerClaim(server);
if (!claim || claim.org !== ens.orgName(org)) throw new Error(`${server} is not claimed by ${ens.orgName(org)}`);
console.log(`${server} is claimed by ${claim.org}`);

const infra = await orgInfra(org);
if (!infra) throw new Error(`org ${org} is not on-chain`);

let key = await readKey(sub);
if (key.live && key.address?.toLowerCase() === signer.address.toLowerCase()) {
  console.log(`co-maintainer ${sub} is already live with key ${signer.address}`);
} else {
  if (key.address) throw new Error(`${sub} exists with a different key ${key.address}. Pick another label.`);
  console.log(`adding co-maintainer ${sub} with key ${signer.address}, ${days} days`);
  const r = await ens.addCoMaintainer({ org, resolver: infra.resolver, registry: infra.registry, label, address: signer.address, expiresAt: Math.floor(Date.now() / 1000) + Number(days) * 86400 });
  for (const t of r.txs) console.log(`  ${t.label}: ${eth(t.hash)}`);
  key = await readKey(sub);
  if (!key.live) throw new Error(`${sub} did not become live`);
}

if (!dockerAvailable()) throw new Error("Docker is not reachable. Run: wsl -u root service docker start");
console.log("deriving the tool manifest in a no-network sandbox…");
const d = await deriveAttestation(server, "latest");
const pair = buildPair(d, signer.address, "gateway", sub);
console.log(`  ${pair.version}: tools ${d.tools.map((t: { name: string }) => t.name).join(", ")}, manifest ${pair.toolManifestHash}`);

const signature = await signer.signMessage({ message: canonicalize(pair) });
const res = await fetch(`${G}/attest/submit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pair, signature, tools: d.tools }) });
const body = await res.json();
if (!res.ok) throw new Error(`gateway refused: ${res.status} ${JSON.stringify(body)}`);
console.log("gateway accepted the attestation");
console.log(JSON.stringify(body, null, 2).slice(0, 1500));

const check = await (await fetch(`${G}/check?server=${encodeURIComponent(server)}`)).json();
console.log(`\ntier now: ${check.tier} (${check.reason}) — ${check.explain}`);
