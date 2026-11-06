import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { canonicalize } from "@proofmark/core";
import { dockerAvailable } from "@proofmark/runner";
import { buildPair, deriveAttestation } from "../attest";
import { readKey, readServerClaim } from "../chain";
import { orgName } from "../ens";

/**
 * The attestation worker. It runs on a machine with a container engine, because the tool manifest must be derived
 * by running the server in a sandbox with no network. The hosted gateway cannot run containers, so the maintainer's
 * browser asks this worker to derive, signs the result with the maintainer's own wallet, and sends it to the gateway,
 * which re-checks everything (POST /attest/submit). The worker holds no keys and signs nothing.
 *
 * It listens on 127.0.0.1 only, so only the maintainer's own browser can reach it.
 *   npm run worker -w @proofmark/gateway
 */
const ALLOWED = ["http://localhost:3000", "http://localhost:3100", "https://proofmark-web.vercel.app", "https://proofmark-web.onrender.com"];
const app = new Hono();
// Browsers ask permission before a public page may reach a local address. This must answer before CORS does.
app.use("*", async (c, next) => {
  c.header("Access-Control-Allow-Private-Network", "true");
  await next();
});
app.use(
  "*",
  cors({
    origin: (o) => (ALLOWED.includes(o) ? o : ""),
    allowHeaders: ["content-type", "access-control-request-private-network"],
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);

app.get("/health", (c) => c.json({ ok: true, docker: dockerAvailable() }));

app.post("/derive", async (c) => {
  const { server, org, label, version } = (await c.req.json()) as { server: string; org: string; label: string; version?: string };
  if (!server || !org || !label) return c.json({ error: "server, org and label are required" }, 400);
  if (!dockerAvailable()) return c.json({ error: "No container engine is reachable. Start Docker (wsl -u root service docker start) and try again." }, 503);

  const claim = await readServerClaim(server);
  if (!claim || claim.org !== orgName(org)) return c.json({ error: `${server} is not claimed by ${orgName(org)} on ENS.` }, 403);
  const subname = `${label}.${orgName(org)}`;
  const key = await readKey(subname);
  if (!key.live || !key.address) return c.json({ error: `${subname} has no live attest key on ENS.` }, 403);

  const d = await deriveAttestation(server, version ?? "latest");
  const pair = buildPair(d, key.address, "gateway", subname);
  return c.json({ pair, message: canonicalize(pair), tools: d.tools, signer: key.address, sandboxed: d.sandboxed });
});

serve({ fetch: app.fetch, port: Number(process.env.WORKER_PORT ?? 8788), hostname: "127.0.0.1" }, (i) => {
  console.log(`Proofmark worker on http://127.0.0.1:${i.port}  docker=${dockerAvailable() ? "yes" : "NO"}`);
});
