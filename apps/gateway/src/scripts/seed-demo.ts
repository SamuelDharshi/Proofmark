import { store, logEvent } from "../store";
import { caps, env } from "../config";
import { fixtures } from "../fixtures";
import { buildPair, deriveAttestation } from "../attest";
import { gatewaySigner, signPair } from "../sign";
import { anchor } from "../hcs";

/**
 * Local demo data only. Claims the bundled demo servers in the gateway store and attests them,
 * so the x402 payment path can be tested before World and ENS are set up.
 * Nothing is written to ENS and the org is NOT marked human-verified.
 * Real claims go through POST /claim with a World proof.
 */
if (!caps.signing || !caps.hedera) throw new Error("Set ATTEST_PRIVATE_KEY and the Hedera gateway account first");

const org = "demo";
const label = "gateway";
const key = gatewaySigner();

store.update((d) => {
  if (!d.orgs.some((o) => o.name === org))
    d.orgs.push({ name: org, ensName: `${org}.${env.ENS_ROOT_NAME}`, owner: key, payTo: env.HEDERA_GATEWAY_ACCOUNT_ID!, price: env.CONNECT_PRICE_USD, worldVerified: false, nullifier: "demo-seed", createdAt: Date.now() });
  if (!d.keys.some((k) => k.org === org && k.label === label))
    d.keys.push({ subname: `${label}.${org}.${env.ENS_ROOT_NAME}`, label, org, address: key, expiresAt: Math.floor(Date.now() / 1000) + 365 * 86400, revoked: false });
});

for (const f of fixtures) {
  store.update((d) => {
    if (!d.claims.some((c) => c.server === f.name)) d.claims.push({ server: f.name, org, claimedAt: Date.now(), ownershipProof: "local fixture (demo seed)" });
  });
  const derived = await deriveAttestation(f.name);
  const pair = buildPair(derived, key, "gateway", `${label}.${org}`);
  const signed = await signPair(pair);
  const hcs = await anchor({ type: "attestation", server: f.name, version: pair.version, artifactHash: pair.artifactHash, toolManifestHash: pair.toolManifestHash, attestKey: pair.attestKey }).catch((e) => {
    console.warn("HCS anchor failed:", (e as Error).message);
    return null;
  });
  store.update((d) => void d.attestations.push({ ...signed, tools: derived.tools, createdAt: Date.now(), hcs: hcs ?? undefined }));
  logEvent({ kind: "attestation", server: f.name, detail: `Demo seed attested ${pair.version}`, tx: hcs ? { chain: "hedera", id: hcs.tx } : undefined });
  console.log(`${f.name}  manifest ${pair.toolManifestHash.slice(0, 14)}…${hcs ? `  hcs https://hashscan.io/testnet/transaction/${hcs.tx}` : ""}`);
}
process.exit(0);
