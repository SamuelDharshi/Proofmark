import { env, caps } from "../config";
import { store, logEvent } from "../store";
import * as ens from "../ens";
import { gatewaySigner } from "../sign";

/**
 * On-chain ENSv2 run on Sepolia for the local demo org. Registers <org>.<root>, adds a co-maintainer
 * whose role covers attest.key only, proves a write to status reverts, and reads the key back.
 * Add --revoke to revoke that co-maintainer with one write and read the result.
 * Usage: npm run ens:spike -w @proofmark/gateway [-- --revoke]
 */
if (!caps.ens) throw new Error("Set SEPOLIA_RPC_URL and ENS_ADMIN_PRIVATE_KEY first");
if (!caps.signing) throw new Error("Set ATTEST_PRIVATE_KEY first");

const org = "demo";
const label = "gateway";
const coMaintainer = gatewaySigner();
const tx = (h: string) => `https://sepolia.etherscan.io/tx/${h}`;
const day = 86400;

let rec = store.get().orgs.find((o) => o.name === org);
const key = () => store.get().keys.find((k) => k.org === org && k.label === label);

if (process.argv.includes("--revoke")) {
  if (!rec?.resolver) throw new Error("run the spike without --revoke first");
  const k = key();
  console.log(`revoking ${label}.${ens.orgName(org)} (one write)...`);
  const r = await ens.revokeCoMaintainer({ org, resolver: rec.resolver as `0x${string}`, label, address: coMaintainer });
  store.update(() => void (k && ((k.revoked = true), (k.revokedAt = Date.now()), (k.ensTx = r.revoke))));
  logEvent({ kind: "revoked", detail: `${r.subname} revoked on ENS`, tx: { chain: "sepolia", id: r.revoke } });
  console.log(`revoke write   ${tx(r.revoke)}`);
  ens.invalidateEns();
  const live = await ens.keyLive(org, label, coMaintainer, rec.registry as `0x${string}`);
  console.log(`key live now:  ${live.live}  (record: ${JSON.stringify(live.record)}, revoked: ${live.revoked})`);
  process.exit(0);
}

console.log(`root ${env.ENS_ROOT_NAME}  admin ${ens.adminAddress()}\n`);

if (!rec?.resolver) {
  console.log(`1/4 registering ${ens.orgName(org)} (registry + resolver proxies, name, records)...`);
  const chain = await ens.registerOrg({
    org, owner: ens.adminAddress(), payTo: env.HEDERA_GATEWAY_ACCOUNT_ID ?? "0.0.0", price: env.CONNECT_PRICE_USD, worldVerified: false,
    expiresAt: Math.floor(Date.now() / 1000) + 365 * day,
  });
  for (const t of chain.txs) console.log(`    ${t.label.padEnd(16)} ${tx(t.hash)}`);
  console.log(`    resolver ${chain.resolver}\n    registry ${chain.registry}`);
  store.update((d) => {
    const o = d.orgs.find((x) => x.name === org);
    if (o) Object.assign(o, { ensName: chain.name, resolver: chain.resolver, registry: chain.registry, ensTx: chain.txs.at(-1)?.hash });
  });
  rec = store.get().orgs.find((o) => o.name === org);
  ens.watchResolver(chain.resolver);
} else console.log("1/4 org already on-chain, skipping");

let k = key();
if (!k?.ensTx) {
  console.log(`\n2/4 adding co-maintainer ${label}.${ens.orgName(org)} (expires in 180 days)...`);
  const exp = Math.floor(Date.now() / 1000) + 180 * day;
  const r = await ens.addCoMaintainer({ org, resolver: rec!.resolver as `0x${string}`, registry: rec!.registry as `0x${string}`, label, address: coMaintainer, expiresAt: exp });
  for (const t of r.txs) console.log(`    ${t.label.padEnd(16)} ${tx(t.hash)}`);
  store.update((d) => {
    const x = d.keys.find((y) => y.org === org && y.label === label);
    if (x) Object.assign(x, { registry: rec!.registry, ensTx: r.txs.at(-1)?.hash, expiresAt: exp, subname: r.subname });
  });
} else console.log("\n2/4 co-maintainer already on-chain, skipping");

console.log("\n3/4 co-maintainer tries to write status (must revert)...");
const u = await ens.unauthorizedWriteDemo({ resolver: rec!.resolver as `0x${string}`, org, from: coMaintainer, key: "status" });
console.log(u.reverted ? `    reverted: ${u.error}` : "    NOT REJECTED: the role is broader than intended");

console.log("\n4/4 reading back through ENS...");
ens.invalidateEns();
const records = await ens.getOrgRecords(org);
console.log(`    ${records.name}  status=${records.status}  payto=${records.payto}  price=${records.price}  owner=${records.owner}`);
const live = await ens.keyLive(org, label, coMaintainer, rec!.registry as `0x${string}`);
console.log(`    ${label}.${records.name}  attest.key=${live.record}  live=${live.live}  expires=${new Date(live.expiresAt * 1000).toISOString().slice(0, 10)}`);
process.exit(0);
