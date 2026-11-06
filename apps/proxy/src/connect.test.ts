import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { privateKeyToAccount } from "viem/accounts";
import { canonicalize, toolManifestHash, type AttestationPair } from "@proofmark/core";
import { captureTools } from "@proofmark/runner";
import { connect } from "./connect.ts";
import type { Identity } from "./identity.ts";

/**
 * The PRD's qualification floor: the manifest is derived by running the artefact,
 * the proxy hashes what the server actually sends, and a mismatch refuses the connection.
 * The gateway is stubbed. x402 is covered by the live Hedera run.
 */
const entry = resolve(import.meta.dirname, "../../demo-server/src/server.ts");
const flag = join(tmpdir(), `proofmark-mutate-${randomBytes(4).toString("hex")}`);
process.env.DEMO_MUTATE_FLAG = flag;
const launch = { command: "npx", args: ["tsx", entry] };

const maintainer = privateKeyToAccount(`0x${randomBytes(32).toString("hex")}`);
const agent = privateKeyToAccount(`0x${randomBytes(32).toString("hex")}`);
const id: Identity = {
  ensName: "claude-1.test.eth",
  hederaAccount: "0.0.1",
  evmAddress: agent.address,
  sign: (m) => agent.signMessage({ message: m }),
  payFetch: fetch,
};

let srv: Server;
let base = "";
let attestedArtifact = "";

test.before(async () => {
  rmSync(flag, { force: true });
  const tools = await captureTools(launch);
  attestedArtifact = "0x" + createHash("sha256").update(readFileSync(entry)).digest("hex");
  const pair: AttestationPair = {
    server: "example.test/filesystem",
    version: "1.0.0",
    registryType: "local",
    artifactHash: attestedArtifact,
    toolManifestHash: toolManifestHash(tools),
    attestKey: maintainer.address,
    revocationCheckedAt: Date.now(),
    buyer: "gateway",
    validUntil: Date.now() + 3600_000,
  };
  const signature = await maintainer.signMessage({ message: canonicalize(pair) });
  srv = createServer((_, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ connected: true, tier: "green", attestation: { pair, signature, signer: maintainer.address, tools }, freshness: { validUntil: Date.now() + 3600_000 } }));
  });
  await new Promise<void>((r) => srv.listen(0, r));
  base = `http://127.0.0.1:${(srv.address() as any).port}`;
});

test.after(() => {
  // fetch keeps connections alive, which would otherwise hold the test file open.
  srv.closeAllConnections();
  srv.close();
  rmSync(flag, { force: true });
});

const opts = () => ({ gateway: base, server: "example.test/filesystem", launch, artifactPath: entry });

test("clean server: both hashes match and the full tool set is permitted", async () => {
  rmSync(flag, { force: true });
  const d = await connect(id, opts());
  assert.equal(d.ok, true);
  if (d.ok) {
    assert.deepEqual(d.tools.map((t) => t.name).sort(), ["list_dir", "read_file"]);
    assert.equal(d.artifactVerified, true);
    await d.session.close();
  }
});

test("mutated server: refused before the model sees tools, added tool is named", async () => {
  writeFileSync(flag, "1");
  const d = await connect(id, opts());
  assert.equal(d.ok, false);
  if (!d.ok) {
    assert.equal(d.reason, "manifest-mismatch");
    assert.match(d.message, /read_env/);
    assert.deepEqual(d.diff?.added, ["read_env"]);
  }
  rmSync(flag, { force: true });
});

test("wrong artefact: refused on the artefact hash", async () => {
  const other = join(tmpdir(), `proofmark-art-${randomBytes(4).toString("hex")}.js`);
  writeFileSync(other, "console.log('not the attested build')");
  const d = await connect(id, { ...opts(), artifactPath: other });
  assert.equal(d.ok, false);
  if (!d.ok) assert.equal(d.reason, "hash-mismatch");
  rmSync(other, { force: true });
});

test("forged signature: refused", async () => {
  const forger = privateKeyToAccount(`0x${randomBytes(32).toString("hex")}`);
  const real = srv.listeners("request")[0] as (req: unknown, res: any) => void;
  srv.removeAllListeners("request");
  srv.on("request", (_req, res) => {
    const pair = { server: "example.test/filesystem", version: "1.0.0", registryType: "local", artifactHash: attestedArtifact, toolManifestHash: "0x0", attestKey: maintainer.address, revocationCheckedAt: 0, buyer: "x", validUntil: Date.now() + 1000 };
    forger.signMessage({ message: canonicalize(pair) }).then((signature) => {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ connected: true, tier: "green", attestation: { pair, signature, tools: [] }, freshness: { validUntil: Date.now() + 1000 } }));
    });
  });
  const d = await connect(id, opts());
  assert.equal(d.ok, false);
  if (!d.ok) assert.equal(d.reason, "bad-signature");
  srv.removeAllListeners("request");
  srv.on("request", real);
});
