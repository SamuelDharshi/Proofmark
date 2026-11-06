import { AccountInfoQuery, Hbar, KeyList, TransferTransaction } from "@hiero-ledger/sdk";
import { privateKeyToAccount } from "viem/accounts";
import { env, caps } from "../config";
import { hederaClient, anchorTo } from "../hcs";
import { verifyBond } from "../bond";
import { allowanceStatus, setAllowance } from "../allowance";
import { agentEns, orgInfra, readAgent, readKey, readServerClaim } from "../chain";
import * as ens from "../ens";
import { deriveAttestation, registryArtifactHash } from "../attest";
import { dockerAvailable } from "@proofmark/runner";
import { watchRevocations } from "../../../proxy/src/revocations";

/**
 * Live end-to-end run. Every step is a real transaction or a real read. It does what can be driven without a person:
 * the bond, the HCS revocation, the Hedera allowance and the sandboxed derivation. The steps that need a person
 * (the World proof, a wallet signature, an Agent Pass approval) are reported as BLOCKED, never faked.
 *
 * Usage: npm run e2e -w @proofmark/gateway [server]
 */
const SERVER = process.argv[2] ?? "io.github.SamuelDharshi/proofmark-files";
const ORG = process.env.E2E_ORG ?? "samuel";
const link = (tx: string) => `https://hashscan.io/testnet/transaction/${tx.replace("@", "-").replace(/\.(\d+)$/, "-$1")}`;
const eth = (h: string) => `https://sepolia.etherscan.io/tx/${h}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let pass = 0;
let fail = 0;
let blocked = 0;
const ok = (c: boolean, name: string, detail = "") => {
  c ? pass++ : fail++;
  console.log(`${c ? "PASS   " : "FAIL   "} ${name}${detail ? `\n         ${detail}` : ""}`);
};
const block = (name: string, why: string) => {
  blocked++;
  console.log(`BLOCKED ${name}\n         ${why}`);
};
const head = (s: string) => console.log(`\n== ${s}`);

if (!caps.hedera || !caps.ens || !caps.hcs || !env.BOND_ACCOUNT_ID || !env.REVOKE_TOPIC_ID) throw new Error("Hedera, ENS, HCS, the bond account and the revocation topic must be configured");
const client = hederaClient();

// ------------------------------------------------------------------ 1. Bond (U3)
head("U3 Bond on Hedera");
const info = await new AccountInfoQuery().setAccountId(env.BOND_ACCOUNT_ID).execute(client);
ok(info.key instanceof KeyList && info.key.threshold === 2 && info.key.toArray().length === 2, "bond account is a 2-of-2 key list", `${env.BOND_ACCOUNT_ID} https://hashscan.io/testnet/account/${env.BOND_ACCOUNT_ID}`);

const deposit = async (hbar: number) => {
  const tx = await new TransferTransaction().addHbarTransfer(env.HEDERA_GATEWAY_ACCOUNT_ID!, new Hbar(-hbar)).addHbarTransfer(env.BOND_ACCOUNT_ID!, new Hbar(hbar)).execute(client);
  await tx.getReceipt(client);
  return tx.transactionId.toString();
};
const big = await deposit(env.BOND_MIN_HBAR);
const small = await deposit(5);
await sleep(7000);
const v1 = await verifyBond(big, env.HEDERA_GATEWAY_ACCOUNT_ID!);
ok(v1.ok, `a ${env.BOND_MIN_HBAR} HBAR deposit from the payout account verifies on the mirror node`, `${v1.detail}\n         ${link(big)}`);
const v2 = await verifyBond(big, "0.0.12345");
ok(!v2.ok, "the same deposit does not verify for a different payout account", v2.detail);
const v3 = await verifyBond(small, env.HEDERA_GATEWAY_ACCOUNT_ID!);
ok(!v3.ok && /minimum/.test(v3.detail), "a deposit below the minimum is rejected", `${v3.detail}\n         ${link(small)}`);
const v4 = await verifyBond("0.0.8149406-1700000000-000000000", env.HEDERA_GATEWAY_ACCOUNT_ID!);
ok(!v4.ok, "a transaction id that does not exist is rejected", v4.detail);

// ------------------------------------------------------------------ 2. Revocation over HCS (U1)
head("U1 Revocation over an HCS topic");
const infra = await orgInfra(ORG);
if (!infra) throw new Error(`org ${ORG} is not on-chain`);
const label = `e2e${Date.now().toString(36).slice(-4)}`;
const attest = privateKeyToAccount(env.ATTEST_PRIVATE_KEY as `0x${string}`).address;
const added = await ens.addCoMaintainer({ org: ORG, resolver: infra.resolver, registry: infra.registry, label, address: attest, expiresAt: Math.floor(Date.now() / 1000) + 86400 });
ok(!!added.subname, `co-maintainer ${added.subname} added with an expiring key and a role scoped to attest.key`, added.txs.map((t) => `${t.label}: ${eth(t.hash)}`).join("\n         "));
ens.invalidateEns();
const live1 = await readKey(added.subname);
ok(live1.live === true, "its key reads as live from ENS");

let hitAt = 0;
let hitSeq = 0;
const stop = watchRevocations({
  topic: env.REVOKE_TOPIC_ID,
  everyMs: 2500,
  matches: (r) => r.subname === added.subname,
  onHit: (r) => {
    if (!hitAt) {
      hitAt = Date.now();
      hitSeq = r.sequence;
    }
  },
});
await sleep(3000);
const t0 = Date.now();
const rev = await ens.revokeCoMaintainer({ org: ORG, resolver: infra.resolver, label, address: attest });
const hcs = await anchorTo(env.REVOKE_TOPIC_ID, { type: "revocation", org: ORG, label, subname: added.subname, address: attest, reason: "end-to-end test", ensTx: rev.revoke, ts: Date.now() });
const tHcs = Date.now();
ok(!!rev.revoke, "revoking clears the key on ENS", eth(rev.revoke));
ok(hcs.sequence > 0, "the revocation is published to the HCS topic", `topic ${hcs.topic} message #${hcs.sequence} https://hashscan.io/testnet/topic/${hcs.topic}`);
for (let i = 0; i < 30 && !hitAt; i++) await sleep(1000);
stop();
ok(!!hitAt, "a subscribed proxy sees the revocation through the mirror node", hitAt ? `${((hitAt - tHcs) / 1000).toFixed(1)}s after the HCS submit, ${((hitAt - t0) / 1000).toFixed(1)}s after the revoke started (message #${hitSeq})` : "no message within 30s");
ens.invalidateEns();
const live2 = await readKey(added.subname);
ok(live2.live === false, "the ENS source of truth agrees: the key is no longer live", `address=${live2.address ?? "cleared"}`);

// ------------------------------------------------------------------ 3. Hedera allowance (U2)
head("U2 Allowance as spend authority");
const agentName = process.env.AGENT_ENS_NAME ?? agentEns("claude-1");
let agent = await readAgent(agentName);
if (!agent?.operator) throw new Error(`${agentName} has no operator record. Run: npm run allowance -w @proofmark/gateway -- approve claude-1 5`);
const a0 = await allowanceStatus(agent, 0.02);
ok(a0.valid && (a0.remainingHbar ?? 0) > 0, "the agent has a capped on-chain allowance", a0.message);
const wTx = await setAllowance(agent.hedera, 0);
await sleep(7000);
const a1 = await allowanceStatus(agent, 0.02);
ok(!a1.valid, "after the operator withdraws it, the gate refuses payment", `${a1.message}\n         ${link(wTx)}`);
const rTx = await setAllowance(agent.hedera, 5);
await sleep(7000);
const a2 = await allowanceStatus(agent, 0.02);
ok(a2.valid, "after the operator approves it again, the gate allows payment", `${a2.message}\n         ${link(rTx)}`);

// ------------------------------------------------------------------ 4. Sandboxed derivation
head("Attestation: sandboxed derivation of the real registry server");
const claim = await readServerClaim(SERVER).catch(() => null);
if (!dockerAvailable()) block("derive in a container", "no container engine reachable (DOCKER_BIN)");
else {
  const d = await deriveAttestation(SERVER);
  const reg = await registryArtifactHash(SERVER);
  ok(d.sandboxed && d.tools.length > 0, `${SERVER}@${d.version} ran with no network, a read-only filesystem and no capabilities`, `tools: ${d.tools.map((t) => t.name).join(", ")}\n         manifest ${d.toolManifestHash}`);
  ok(d.artifactHash === reg.hash, "its artefact hash equals what the registry publishes", reg.hash.slice(0, 40) + "…");
}
if (!claim) {
  block("claim, namespace proof, World credential", `${SERVER} is not claimed yet. It needs the gist, the World proof and your wallet`);
  block("attest with the maintainer's key, mint the certificate, paid connect", "waits for the claim, then a World Agent Pass approval");
}

console.log(`\n${pass} passed, ${fail} failed, ${blocked} blocked on a person`);
process.exit(fail === 0 ? 0 : 1);
