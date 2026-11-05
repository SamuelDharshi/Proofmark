import { Hono } from "hono";
import { existsSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { getAddress, isAddress } from "viem";
import { hederaTopicUrl, hederaAccountUrl } from "@proofmark/core";
import { caps, env } from "../config";
import { store } from "../store";
import { evaluate } from "../check";
import { fixtures, repoRoot } from "../fixtures";
import { searchRegistry, packageKind } from "../registry";
import { readLog } from "../hcs";
import { agentPass, upsertAgent, getAgentByName, budgetLeft } from "../agents";
import { ensAddresses, adminAddress } from "../ens";
import { priceFor } from "../x402";

export const publicRoutes = new Hono();

publicRoutes.get("/health", (c) => c.json({ ok: true, ts: Date.now() }));

/** What this gateway has wired up. The UI uses it to show setup state instead of faking data. */
publicRoutes.get("/config", (c) =>
  c.json({
    caps,
    network: "hedera:testnet",
    facilitator: env.X402_FACILITATOR_URL,
    asset: env.X402_ASSET,
    defaultPriceUsd: env.CONNECT_PRICE_USD,
    maxPriceUsd: env.MAX_PRICE_USD,
    agentPassMode: env.AGENT_PASS_MODE,
    world: { environment: env.WORLD_ENVIRONMENT, appId: env.WORLD_APP_ID ?? null, action: env.WORLD_ACTION },
    ens: { root: env.ENS_ROOT_NAME, chainId: 11155111, contracts: ensAddresses, admin: caps.ens ? adminAddress() : null },
    hedera: {
      gatewayAccount: env.HEDERA_GATEWAY_ACCOUNT_ID ?? null,
      gatewayAccountUrl: env.HEDERA_GATEWAY_ACCOUNT_ID ? hederaAccountUrl(env.HEDERA_GATEWAY_ACCOUNT_ID) : null,
      topic: env.HCS_TOPIC_ID ?? null,
      topicUrl: env.HCS_TOPIC_ID ? hederaTopicUrl(env.HCS_TOPIC_ID) : null,
    },
  }),
);

/** Public, free, unauthenticated. Any name resolves, unclaimed names honestly return sandboxed. */
publicRoutes.get("/check", async (c) => {
  const server = c.req.query("server");
  if (!server) return c.json({ error: "server is required" }, 400);
  const { keyState, ...r } = await evaluate(server, c.req.query("version"));
  return c.json({ ...r, keySource: keyState?.source ?? null });
});

/** Marketplace listing: claimed and fixture servers first, then registry results. */
publicRoutes.get("/servers", async (c) => {
  const search = c.req.query("search")?.trim();
  const db = store.get();
  const names = new Map<string, { title?: string; description?: string; source: string; kind?: string; version?: string }>();
  for (const f of fixtures) names.set(f.name, { title: f.title, description: f.description, source: "demo", kind: "local", version: f.version });
  for (const cl of db.claims) if (!names.has(cl.server)) names.set(cl.server, { source: "registry" });
  if (search || names.size < 12) {
    const found = await searchRegistry(search || "mcp", 24).catch(() => []);
    for (const s of found) if (!names.has(s.name)) names.set(s.name, { title: s.title ?? s.name, description: s.description, source: "registry", kind: packageKind(s).type, version: s.version });
  }
  const rows = await Promise.all(
    [...names.entries()].map(async ([server, meta]) => {
      const { keyState: _k, tools, ...r } = await evaluate(server);
      return { ...r, ...meta, toolCount: tools?.length ?? null, priceUsd: priceFor(server).usd };
    }),
  );
  const q = search?.toLowerCase();
  const filtered = q ? rows.filter((r) => r.server.toLowerCase().includes(q) || (r.title ?? "").toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q)) : rows;
  const rank = { green: 0, blocked: 1, sandboxed: 2 } as const;
  filtered.sort((a, b) => rank[a.tier] - rank[b.tier]);
  return c.json({ servers: filtered });
});

/** Fleet view: every agent, its pass, budget and the latest events. */
publicRoutes.get("/fleet", async (c) => {
  const db = store.get();
  const agents = await Promise.all(
    db.agents.map(async (a) => {
      const pass = await agentPass(a.evmAddress).catch(() => ({ valid: false, message: "lookup failed", mode: env.AGENT_PASS_MODE }));
      const last = db.events.find((e) => e.agent === a.ensName || e.agent === a.hederaAccount || e.agent === a.evmAddress);
      return { ...a, budgetLeft: budgetLeft(a), pass, last };
    }),
  );
  return c.json({ agents, events: db.events.slice(0, 60), payments: db.payments.slice(0, 40), orgs: db.orgs, keys: db.keys, claims: db.claims });
});

publicRoutes.post("/agents", async (c) => {
  const b = (await c.req.json()) as { ensName: string; evmAddress: string; hederaAccount: string; budgetUsd?: number; maxRisk?: "green" | "sandboxed" };
  if (!b.ensName || !isAddress(b.evmAddress ?? "") || !/^\d+\.\d+\.\d+$/.test(b.hederaAccount ?? "")) return c.json({ error: "ensName, evmAddress and hederaAccount are required" }, 400);
  return c.json(upsertAgent({ ...b, evmAddress: getAddress(b.evmAddress) }));
});

publicRoutes.get("/agents/:name", async (c) => {
  const a = getAgentByName(c.req.param("name"));
  if (!a) return c.json({ error: "unknown agent" }, 404);
  const pass = await agentPass(a.evmAddress).catch(() => null);
  return c.json({ ensName: a.ensName, budgetUsd: a.budgetUsd, spentUsd: a.spentUsd, budgetLeft: budgetLeft(a), maxRisk: a.maxRisk, pass });
});

/** Demo control: expire or restore an agent's pass to show the denied path. */
publicRoutes.post("/agents/:name/pass", async (c) => {
  const a = getAgentByName(c.req.param("name"));
  if (!a) return c.json({ error: "unknown agent" }, 404);
  const { valid } = (await c.req.json()) as { valid: boolean };
  return c.json(upsertAgent({ ensName: a.ensName, evmAddress: a.evmAddress, hederaAccount: a.hederaAccount, passValid: valid, passExpiresAt: undefined }));
});

/** Clients report the manifest hash they observed. Divergence across clients is flagged. */
publicRoutes.post("/gossip", async (c) => {
  const b = (await c.req.json()) as { server: string; version: string; observedHash: string; client: string };
  if (!b.server || !b.observedHash) return c.json({ error: "server and observedHash are required" }, 400);
  store.update((d) => {
    d.gossip.unshift({ server: b.server, version: b.version ?? "latest", observedHash: b.observedHash, client: b.client ?? "unknown", ts: Date.now() });
    d.gossip = d.gossip.slice(0, 1000);
  });
  return c.json({ ok: true });
});

publicRoutes.get("/hcs", async (c) => c.json({ topic: env.HCS_TOPIC_ID ?? null, topicUrl: env.HCS_TOPIC_ID ? hederaTopicUrl(env.HCS_TOPIC_ID) : null, messages: await readLog(Number(c.req.query("limit") ?? 25)) }));

// ---- demo toggle for the tool-poisoning beat ----
const flag = resolve(repoRoot, "apps/demo-server/.mutate");
publicRoutes.get("/demo/mutation", (c) => c.json({ mutated: existsSync(flag) }));
publicRoutes.post("/demo/mutation", async (c) => {
  const { on } = (await c.req.json()) as { on: boolean };
  if (on) writeFileSync(flag, "1");
  else rmSync(flag, { force: true });
  return c.json({ mutated: on });
});
