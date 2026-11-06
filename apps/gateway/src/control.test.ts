import assert from "node:assert/strict";
import { test } from "node:test";
import { challengeFor, verifyControl } from "./control";

const wallet = "0x301ea090e957c28ca536ab8679ebef2d354febd8";
const server = "io.github.SamuelDharshi/proofmark-files";
const good = "a".repeat(32);
const other = "b".repeat(32);

/** Serves a fake gist page for SamuelDharshi, so the rule is tested without GitHub. */
function withGists(raw: Record<string, string>, fn: () => Promise<void>) {
  const real = globalThis.fetch;
  globalThis.fetch = (async (u: string | URL | Request) => {
    const url = String(u);
    if (url === "https://gist.github.com/SamuelDharshi") return new Response(Object.keys(raw).map((id) => `<a href="/SamuelDharshi/${id}"></a>`).join(""));
    const id = Object.keys(raw).find((k) => url.endsWith(`/${k}/raw`));
    return id ? new Response(raw[id]) : new Response("", { status: 404 });
  }) as typeof fetch;
  return fn().finally(() => void (globalThis.fetch = real));
}

test("the published line proves control", () =>
  withGists({ [other]: "nothing here", [good]: `notes\n${challengeFor(server, wallet)}\n` }, async () => {
    const r = await verifyControl(server, wallet);
    assert.equal(r.ok, true);
  }));

test("a different wallet is not proven by someone else's line", () =>
  withGists({ [good]: challengeFor(server, wallet) }, async () => {
    assert.equal((await verifyControl(server, "0x0000000000000000000000000000000000000002")).ok, false);
  }));

test("a different server is not proven by the line for this one", () =>
  withGists({ [good]: challengeFor(server, wallet) }, async () => {
    assert.equal((await verifyControl("io.github.SamuelDharshi/other", wallet)).ok, false);
  }));

test("a line that only contains the challenge as part of a longer line does not count", () =>
  withGists({ [good]: `please ${challengeFor(server, wallet)} thanks` }, async () => {
    assert.equal((await verifyControl(server, wallet)).ok, false);
  }));
