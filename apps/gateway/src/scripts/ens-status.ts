import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { labelhash, zeroAddress, formatEther, type Address } from "viem";
import { env } from "../config";
import { publicClient, adminAddress } from "../ens";
import { caps } from "../config";

/** Read-only: who owns the root name, what it points at, and whether the admin wallet can manage it. */
const dep = JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../ens/deployments.sepolia.json"), "utf8"));
const reg = dep.contracts.ETHRegistry;
const label = env.ENS_ROOT_NAME.split(".")[0];
const id = BigInt(labelhash(label));
const pc = publicClient();
const read = (fn: string, args: unknown[]) => pc.readContract({ address: reg.address, abi: reg.abi, functionName: fn, args } as any).catch((e: Error) => `error: ${e.message.split("\n")[0]}`);

// ENSv2 token ids carry version bits, so ask the registry for the current state instead of using the labelhash.
const state = (await read("getState", [id])) as { status: number; expiry: bigint; latestOwner: string } | string;
const owner = typeof state === "string" ? state : state.latestOwner;
const expiry = typeof state === "string" ? state : state.expiry;
const sub = (await read("getSubregistry", [label])) as string;
const res = (await read("getResolver", [label])) as string;

console.log(`name        ${env.ENS_ROOT_NAME}`);
console.log(`owner       ${owner}`);
console.log(`expires     ${typeof expiry === "bigint" ? new Date(Number(expiry) * 1000).toISOString().slice(0, 10) : expiry}`);
console.log(`subregistry ${sub === zeroAddress ? "none yet (the gateway creates it on first claim)" : sub}`);
console.log(`resolver    ${res === zeroAddress ? "none" : res}`);

if (caps.ens) {
  const me = adminAddress();
  const bal = await pc.getBalance({ address: me as Address });
  console.log(`\nadmin wallet ${me}  ${formatEther(bal)} Sepolia ETH`);
  console.log(me.toLowerCase() === String(owner).toLowerCase() ? "admin wallet OWNS the name: ready" : "admin wallet is NOT the owner of this name");
} else {
  console.log("\nENS_ADMIN_PRIVATE_KEY is not set yet");
}
process.exit(0);
