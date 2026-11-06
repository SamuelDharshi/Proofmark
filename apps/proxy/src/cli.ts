#!/usr/bin/env tsx
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { diffManifests, hederaTxUrl, toolManifestHash, type McpTool } from "@proofmark/core";
import { loadIdentity } from "./identity";
import { connect, type Connected } from "./connect";
import { watchRevocations } from "./revocations";

// stdout belongs to the MCP stream. Everything human-readable goes to stderr.
const log = (msg: string, extra?: Record<string, unknown>) => console.error(`[proofmark] ${msg}${extra ? " " + JSON.stringify(extra) : ""}`);

function parseArgs(argv: string[]) {
  const dash = argv.indexOf("--");
  const flags = dash >= 0 ? argv.slice(0, dash) : argv;
  const launch = dash >= 0 ? argv.slice(dash + 1) : [];
  const get = (n: string) => {
    const i = flags.indexOf(`--${n}`);
    return i >= 0 ? flags[i + 1] : undefined;
  };
  const server = get("server");
  if (!server) {
    console.error("usage: proofmark-proxy --server <registry name> [--version v] [--gateway url] [--artifact file] -- <command> [args]");
    process.exit(2);
  }
  return {
    server,
    version: get("version"),
    gateway: get("gateway") ?? process.env.PROOFMARK_GATEWAY_URL ?? "http://localhost:8787",
    artifactPath: get("artifact"),
    launch: launch.length ? { command: launch[0], args: launch.slice(1) } : undefined,
  };
}

const opts = parseArgs(process.argv.slice(2));
const id = loadIdentity();

type State = { status: "connecting" } | { status: "connected"; c: Connected } | { status: "blocked"; reason: string; message: string };
let state: State = { status: "connecting" };

const mcp = new Server({ name: "proofmark-proxy", version: "0.1.0" }, { capabilities: { tools: { listChanged: true } } });

const meta: McpTool[] = [
  { name: "proofmark_explain", description: "Explain why this server got its tier.", inputSchema: { type: "object", properties: {} } },
  { name: "proofmark_budget", description: "Remaining spend and Agent Pass status for this agent.", inputSchema: { type: "object", properties: {} } },
];

const visibleTools = (): McpTool[] => (state.status === "connected" ? [...state.c.tools, ...meta] : meta);

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: visibleTools() as any }));

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  if (name === "proofmark_explain") {
    const text =
      state.status === "connected"
        ? `Connected to ${opts.server} (${state.c.tier}). Attested version ${state.c.attested.version}. Manifest ${state.c.attested.manifestHash.slice(0, 12)}…${state.c.payment ? ` Paid: ${hederaTxUrl(state.c.payment.tx)}` : ""}`
        : state.status === "blocked"
          ? `Blocked: ${state.message}`
          : "Connecting…";
    return { content: [{ type: "text", text }] };
  }
  if (name === "proofmark_budget") {
    const r = await fetch(`${opts.gateway}/agents/${encodeURIComponent(id.ensName)}`).then((x) => x.json()).catch(() => null);
    return { content: [{ type: "text", text: r ? JSON.stringify(r) : "Budget unavailable." }] };
  }
  if (state.status !== "connected") return { isError: true, content: [{ type: "text", text: "Server is not connected." }] };
  if (!state.c.tools.some((t) => t.name === name)) return { isError: true, content: [{ type: "text", text: `Tool ${name} is not permitted.` }] };
  return (await state.c.session.client.callTool({ name, arguments: args })) as any;
});

async function gossip(hash: string, version: string) {
  await fetch(`${opts.gateway}/gossip`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ server: opts.server, version, observedHash: hash, client: id.ensName }),
  }).catch(() => {});
}

async function block(reason: string, message: string) {
  if (state.status === "connected") await state.c.session.close().catch(() => {});
  state = { status: "blocked", reason, message };
  log(`BLOCKED ${reason}: ${message}`);
  await mcp.sendToolListChanged().catch(() => {});
}

async function main() {
  await mcp.connect(new StdioServerTransport());
  log(`resolving ${opts.server} as ${id.ensName}`, { gateway: opts.gateway });

  const d = await connect(id, opts).catch((e) => ({ ok: false as const, reason: "error", message: (e as Error).message }));
  if (!d.ok) {
    if ((d as any).payment?.tx) log(`payment ${hederaTxUrl((d as any).payment.tx)}`);
    await block(d.reason, d.message);
    return;
  }
  state = { status: "connected", c: d };
  log(`connected, tier ${d.tier}`, { tools: d.tools.map((t) => t.name), free: d.free, artifactVerified: d.artifactVerified });
  if (d.payment) log(`paid over x402: ${hederaTxUrl(d.payment.tx)}`);
  await gossip(toolManifestHash(d.session.tools), d.attested.version);
  await mcp.sendToolListChanged().catch(() => {});

  // A connect-time check alone is bypassed by mutating mid-session, so re-hash on every list_changed.
  d.session.onToolsChanged(async () => {
    try {
      const now = (await d.session.client.listTools()).tools as McpTool[];
      const h = toolManifestHash(now);
      if (d.tier === "green" && h !== d.attested.manifestHash) {
        const diff = diffManifests(d.attested.tools, now);
        await gossip(h, d.attested.version);
        await block("manifest-mismatch", `tool list changed mid-session${diff.added.length ? `: added ${diff.added.join(", ")}` : ""}`);
      }
    } catch (e) {
      await block("error", (e as Error).message);
    }
  });

  // Fast path: a revocation published to the Hedera topic reaches this session in seconds.
  const cfg = (await fetch(`${opts.gateway}/config`).then((x) => x.json()).catch(() => null)) as any;
  if (cfg?.revocations?.topic && d.attested.attestSubname) {
    watchRevocations({
      topic: cfg.revocations.topic,
      matches: (r) => r.subname === d.attested.attestSubname || r.address.toLowerCase() === (d.attested.attestKey ?? "").toLowerCase(),
      onHit: (r) => void block("key-revoked", `${r.subname} was revoked (HCS message ${r.sequence}): ${r.reason}`),
      everyMs: Number(process.env.PROOFMARK_REVOCATION_POLL_MS ?? 5000),
    });
    log("watching the revocation topic", { topic: cfg.revocations.topic });
  }

  // Liveness: revocation reaches a running session on the next check.
  // Fail closed: if liveness cannot be confirmed for a few checks in a row, the session is not trusted any more.
  const every = Number(process.env.PROOFMARK_RECHECK_MS ?? 15000);
  const maxMissed = Number(process.env.PROOFMARK_MAX_MISSED_CHECKS ?? 3);
  let missed = 0;
  setInterval(async () => {
    if (state.status !== "connected" || state.c.tier !== "green") return;
    const r = (await fetch(`${opts.gateway}/check?server=${encodeURIComponent(opts.server)}`, { signal: AbortSignal.timeout(10_000) })
      .then((x) => (x.ok ? x.json() : null))
      .catch(() => null)) as any;
    if (!r) {
      if (++missed >= maxMissed) await block("liveness-unknown", `could not confirm the maintainer's key is still live for ${Math.round((missed * every) / 1000)}s`);
      return;
    }
    missed = 0;
    if (r.tier !== "green") await block(r.reason, r.explain);
  }, every).unref?.();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
