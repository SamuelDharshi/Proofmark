import assert from "node:assert/strict";
import { test } from "node:test";
import { watchRevocations } from "./revocations";

const msg = (seq: number, ts: string, body: object) => ({ sequence_number: seq, consensus_timestamp: ts, message: Buffer.from(JSON.stringify(body)).toString("base64") });

function stubMirror(batches: object[][]) {
  let call = 0;
  return (async () => new Response(JSON.stringify({ messages: batches[Math.min(call++, batches.length - 1)] }))) as unknown as typeof fetch;
}

test("a revocation for this key is delivered, others are ignored", async () => {
  const hits: number[] = [];
  const stop = watchRevocations({
    topic: "0.0.1",
    everyMs: 10,
    fetchImpl: stubMirror([
      [msg(1, "1.000000001", { type: "revocation", org: "acme", subname: "bob.acme.proofmark.eth", address: "0xB0B", reason: "other key" }), msg(2, "1.000000002", { type: "payment" })],
      [msg(3, "1.000000003", { type: "revocation", org: "acme", subname: "alice.acme.proofmark.eth", address: "0xA11CE", reason: "leaked" })],
    ]),
    matches: (r) => r.subname === "alice.acme.proofmark.eth",
    onHit: (r) => hits.push(r.sequence),
  });
  await new Promise((r) => setTimeout(r, 120));
  stop();
  assert.deepEqual(hits, [3]);
});

test("a failing mirror node never raises a block by itself", async () => {
  let hit = false;
  const stop = watchRevocations({ topic: "0.0.1", everyMs: 10, fetchImpl: (async () => { throw new Error("offline"); }) as unknown as typeof fetch, matches: () => true, onHit: () => (hit = true) });
  await new Promise((r) => setTimeout(r, 60));
  stop();
  assert.equal(hit, false);
});
