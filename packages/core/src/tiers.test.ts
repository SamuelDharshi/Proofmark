import test from "node:test";
import assert from "node:assert/strict";
import { decideTier } from "./tiers.ts";
import { editDistance, findTyposquat } from "./editDistance.ts";

const ok = { claimed: true, attested: true, artifactMatch: true, manifestMatch: true, keyLive: true };

test("green when everything holds", () => assert.equal(decideTier(ok).tier, "green"));
test("unclaimed is sandboxed", () => assert.equal(decideTier({ ...ok, claimed: false }).tier, "sandboxed"));
test("manifest mismatch blocks", () => assert.equal(decideTier({ ...ok, manifestMatch: false }).reason, "manifest-mismatch"));
test("revoked key blocks", () => assert.equal(decideTier({ ...ok, keyLive: false }).reason, "key-revoked"));
test("typosquat blocks before anything else", () => assert.equal(decideTier({ ...ok, typosquatOf: "x" }).reason, "typosquat"));
test("edit distance", () => {
  assert.equal(editDistance("filesystem", "filesytem"), 1);
  assert.equal(editDistance("abc", "xyz"), 3);
});
test("typosquat detection", () => {
  assert.equal(findTyposquat("io.evil/filesytem", ["io.acme/filesystem"]), "io.acme/filesystem");
  assert.equal(findTyposquat("io.acme/filesystem", ["io.acme/filesystem"]), null);
  assert.equal(findTyposquat("io.x/postgres", ["io.acme/filesystem"]), null);
});
