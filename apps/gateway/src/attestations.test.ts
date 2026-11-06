import assert from "node:assert/strict";
import { test } from "node:test";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { canonicalize, type AttestationPair } from "@proofmark/core";
import { env } from "./config";
import { store } from "./store";
import { syncAttestationsFromHcs } from "./attestations";

/**
 * The local attestation index is a cache of the HCS topic. This proves it is rebuilt from the topic, that a message
 * with a forged signature is ignored, and that the rebuilt record carries exactly what was signed.
 */
const maintainer = privateKeyToAccount(generatePrivateKey());
const pair: AttestationPair = {
  server: "example.test/sync-check",
  version: "1.0.0",
  registryType: "npm",
  artifactHash: "sha512-test",
  toolManifestHash: "0x" + "ab".repeat(32),
  attestKey: maintainer.address,
  attestSubname: "ci.acme.proofmark.eth",
  revocationCheckedAt: 1,
  buyer: "gateway",
  validUntil: 2,
};

const asMessage = (seq: number, body: object) => ({ sequence_number: seq, consensus_timestamp: `${1700000000 + seq}.000000000`, message: Buffer.from(JSON.stringify(body)).toString("base64") });
const record = (sig: string) => ({ type: "attestation", server: pair.server, version: pair.version, artifactHash: pair.artifactHash, toolManifestHash: pair.toolManifestHash, attestKey: pair.attestKey, subname: pair.attestSubname, rt: pair.registryType, rc: pair.revocationCheckedAt, vu: pair.validUntil, sig, tn: ["list_dir", "read_file"] });

test("a restarted gateway rebuilds attestations from HCS and ignores a forged one", async () => {
  const good = await maintainer.signMessage({ message: canonicalize(pair) });
  const forged = await privateKeyToAccount(generatePrivateKey()).signMessage({ message: canonicalize(pair) });
  const before = structuredClone(store.get().attestations);
  const real = globalThis.fetch;
  globalThis.fetch = (async (u: string | URL | Request) =>
    String(u).includes(`/topics/${env.HCS_TOPIC_ID}/messages`)
      ? new Response(JSON.stringify({ messages: [asMessage(900001, record(forged)), asMessage(900002, record(good)), asMessage(900003, { type: "payment" })] }))
      : real(u)) as typeof fetch;
  try {
    store.update((d) => void (d.attestations = d.attestations.filter((a) => a.pair.server !== pair.server)));
    const added = await syncAttestationsFromHcs(true);
    const found = store.get().attestations.filter((a) => a.pair.server === pair.server);
    assert.equal(added, 1, "only the correctly signed message is restored");
    assert.equal(found.length, 1);
    assert.equal(found[0].signature, good);
    assert.deepEqual(found[0].pair, pair, "the rebuilt pair is byte-for-byte what was signed");
    assert.deepEqual(found[0].tools.map((t) => t.name), ["list_dir", "read_file"]);
    assert.equal(await syncAttestationsFromHcs(true), 0, "syncing again adds nothing");
  } finally {
    globalThis.fetch = real;
    store.update((d) => void (d.attestations = before));
  }
});
