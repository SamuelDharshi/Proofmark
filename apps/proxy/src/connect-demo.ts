import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { hederaTxUrl } from "@proofmark/core";
import { loadIdentity } from "./identity";
import { connect } from "./connect";

/**
 * One full connect through the real proxy code: pay over x402, verify both hashes, spawn, compare.
 * Usage: npm run connect:demo -w @proofmark/proxy -- [server]
 */
const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, "../../demo-server/src/server.ts");
const server = process.argv[2] ?? "io.proofmark.demo/filesystem";
const gateway = process.env.PROOFMARK_GATEWAY_URL ?? "http://localhost:8787";

const id = loadIdentity();
console.log(`agent ${id.ensName}  payer ${id.hederaAccount}  evm ${id.evmAddress}`);
console.log(`connecting to ${server} via ${gateway}\n`);

const d = await connect(id, { gateway, server, launch: { command: "npx", args: ["tsx", entry] }, artifactPath: entry });

if (d.ok) {
  console.log(`CONNECTED  tier ${d.tier}  free ${d.free}  artefact verified ${d.artifactVerified}`);
  console.log(`tools: ${d.tools.map((t) => t.name).join(", ")}`);
  if (d.payment) console.log(`paid over x402: ${hederaTxUrl(d.payment.tx)}`);
  await d.session.close();
} else {
  console.log(`REFUSED  ${d.reason}\n${d.message}`);
  if (d.payment) console.log(`payment: ${hederaTxUrl(d.payment.tx)}`);
}
process.exit(d.ok ? 0 : 1);
