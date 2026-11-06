import { Hono } from "hono";
import { verifyMessage, getAddress } from "viem";
import { hederaTopicUrl, hederaAccountUrl } from "@proofmark/core";
import { caps, env } from "../config";
import { store } from "../store";
import { evaluate } from "../check";
import { describeServer } from "../describe";
import { searchRegistry, packageKind } from "../registry";
import { readLog, paymentMessages, spentUsd } from "../hcs";
import { loadAgent, passStatus, budgetLeft } from "../agents";
import { startAgentPass, pollAgentPass, idpStatus } from "../idp";
import { readKey, writePass } from "../chain";
import { ensAddresses, adminAddress } from "../ens";

export const publicRoutes = new Hono();

publicRoutes.get("/health", (c) => c.json({ ok: true, ts: Date.now() }));

/** What this gateway has wired up. The UI shows setup state from this instead of faking data. */
publicRoutes.get("/config", (c) =>
  c.json({
    caps,
    network: "hedera:testnet",
    facilitator: env.X402_FACILITATOR_URL,
    asset: env.X402_ASSET,
    defaultPriceUsd: env.CONNECT_PRICE_USD,
    maxPriceUsd: env.MAX_PRICE_USD,
    agentPass: idpStatus(),
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

/** Public, free, unauthenticated. Any name resolves, and an unclaimed name honestly returns sandboxed. */
publicRoutes.get("/check", async (c) => {
  const server = c.req.query("server");
  if (!server) return c.json({ error: "server is required" }, 400);
  const { key, ...r } = await evaluate(server, c.req.query("version"));
  // Registry details are fetched on request only, because the proxy re-checks liveness every few seconds.
  const info = c.req.query("details") ? await describeServer(server).catch(() => null) : undefined;
  return c.json({ ...r, keySource: key ? "ens" : null, ...(info ? { info } : {}) });
});

/** Marketplace listing: servers claimed through this gateway first, then the official registry. */
publicRoutes.get("/servers", async (c) => {
  const search = c.req.query("search")?.trim();
  const names = new Map<string, { title?: string; description?: string; kind?: string; version?: string }>();
  for (const cl of store.get().claims) names.set(cl.server, {});
  const found = await searchRegistry(search || "mcp", 24).catch(() => []);
  for (const s of found) if (!names.has(s.name) || !names.get(s.name)?.title) names.set(s.name, { title: s.title ?? s.name, description: s.description, kind: packageKind(s).type, version: s.version });
  const rows = await Promise.all(
    [...names.entries()].map(async ([server, meta]) => {
      const { key: _k, tools, ...r } = await evaluate(server);
      return { ...r, ...meta, source: "registry", toolCount: tools?.length ?? null, priceUsd: r.price ?? env.CONNECT_PRICE_USD };
    }),
  );
  const q = search?.toLowerCase();
  const filtered = q ? rows.filter((r) => r.server.toLowerCase().includes(q) || (r.title ?? "").toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q)) : rows;
  const rank = { green: 0, blocked: 1, sandboxed: 2 } as const;
  filtered.sort((a, b) => rank[a.tier] - rank[b.tier]);
  return c.json({ servers: filtered });
});

/** Fleet view. Agents, passes and budgets are read from ENS and the HCS log, not from a local file. */
publicRoutes.get("/fleet", async (c) => {
  const db = store.get();
  const agents = (
    await Promise.all(
      db.agents.map(async (idx) => {
        const a = await loadAgent(idx.ensName).catch(() => null);
        if (!a) return null;
        const spent = await spentUsd(a.hedera).catch(() => 0);
        const last = db.events.find((e) => e.agent === a.ensName || e.agent === a.hedera);
        return { ensName: a.ensName, hederaAccount: a.hedera, evmAddress: a.evm, budgetUsd: a.budgetUsd, spentUsd: spent, budgetLeft: await budgetLeft(a), maxRisk: a.maxRisk, allowedTools: a.allowedTools, pass: passStatus(a), last };
      }),
    )
  ).filter(Boolean);
  const keys = await Promise.all(db.keys.map(async (k) => ({ ...k, live: (await readKey(k.subname).catch(() => null))?.live ?? false })));
  const payments = (await paymentMessages().catch(() => [])).slice(0, 40).map((p) => ({ id: p.txId, txId: p.txId, buyer: p.buyer, server: p.server, usd: p.usd, payTo: "", ts: p.ts }));
  return c.json({ agents, events: db.events.slice(0, 60), payments, orgs: db.orgs, keys, claims: db.claims });
});

publicRoutes.get("/agents/:name", async (c) => {
  const a = await loadAgent(c.req.param("name")).catch(() => null);
  if (!a) return c.json({ error: "unknown agent" }, 404);
  return c.json({ ensName: a.ensName, budgetUsd: a.budgetUsd, spentUsd: await spentUsd(a.hedera), budgetLeft: await budgetLeft(a), maxRisk: a.maxRisk, allowedTools: a.allowedTools, pass: passStatus(a) });
});

// ---- World ID Agent Pass ----
/** Only the agent's own wallet or the ENS admin may start or revoke a pass, so nobody can bind themselves to someone else's agent. */
async function authorized(name: string, action: string, ts: string, sig: string) {
  if (!ts || !sig || Math.abs(Date.now() - Number(ts)) > 120_000) return false;
  const a = await loadAgent(name).catch(() => null);
  if (!a) return false;
  const message = `proofmark:${action}:${name}:${ts}`;
  for (const who of [a.evm, adminAddress()]) {
    if (await verifyMessage({ address: getAddress(who), message, signature: sig as `0x${string}` }).catch(() => false)) return true;
  }
  return false;
}

publicRoutes.post("/agents/:name/pass/start", async (c) => {
  const name = c.req.param("name");
  const { ts, sig } = (await c.req.json()) as { ts: string; sig: string };
  if (!(await authorized(name, "pass-start", ts, sig))) return c.json({ error: "signature from the agent wallet or the ENS admin required" }, 403);
  try {
    return c.json(await startAgentPass(name));
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }
});

publicRoutes.post("/agent-pass/poll", async (c) => {
  const { attemptId } = (await c.req.json()) as { attemptId: string };
  return c.json(await pollAgentPass(attemptId));
});

/** Revoking clears the pass records on ENS. Spend authority ends on the next check. */
publicRoutes.post("/agents/:name/pass/revoke", async (c) => {
  const name = c.req.param("name");
  const { ts, sig } = (await c.req.json()) as { ts: string; sig: string };
  if (!(await authorized(name, "pass-revoke", ts, sig))) return c.json({ error: "signature from the agent wallet or the ENS admin required" }, 403);
  const tx = await writePass(name, null);
  return c.json({ ok: true, tx });
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
