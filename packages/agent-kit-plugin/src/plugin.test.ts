import assert from "node:assert/strict";
import { proofmarkPlugin } from "./index";

/** Runs the plugin's tools against a real gateway. Set PROOFMARK_GATEWAY_URL to test a local one. */
const ctx = {} as any;
const tools = proofmarkPlugin().tools(ctx);
assert.deepEqual(tools.map((t) => t.method), ["proofmark_check_server", "proofmark_agent_identity"]);

const check = tools[0];
const out = check.outputParser!(await check.execute(null as any, ctx, { server: "ai.adeu/adeu" }));
console.log(out.humanMessage);
assert.match(out.humanMessage, /ai\.adeu\/adeu: (GREEN|SANDBOXED|BLOCKED)/);

const who = tools[1];
const a = who.outputParser!(await who.execute(null as any, ctx, { ensName: "claude-1.agents.proofmark.eth" }));
console.log(a.humanMessage);
assert.match(a.humanMessage, /claude-1\.agents\.proofmark\.eth/);
console.log("ok");
