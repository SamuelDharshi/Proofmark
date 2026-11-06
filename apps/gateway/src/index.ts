import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { env, caps } from "./config";
import { publicRoutes } from "./routes/public";
import { claimRoutes } from "./routes/claim";
import { attestRoutes } from "./routes/attest";
import { store } from "./store";
import * as ens from "./ens";
import { orgInfra } from "./chain";
import { syncAttestationsFromHcs } from "./attestations";

const app = new Hono();
app.use("*", cors({ origin: "*", allowHeaders: ["*"], exposeHeaders: ["*"] }));
app.route("/", publicRoutes);
app.route("/", claimRoutes);
app.route("/attest", attestRoutes);
app.onError((e, c) => {
  console.error(e);
  return c.json({ error: e.message }, 500);
});

// Resume chain watchers for every org this gateway knows, found through the root registry.
if (caps.ens) for (const o of store.get().orgs) orgInfra(o.name).then((x) => x && ens.watchResolver(x.resolver)).catch(() => {});

// The local attestation index is a cache of the HCS topic. Rebuild it at start and keep it fresh.
syncAttestationsFromHcs(true).then((n) => n && console.log(`[hcs] restored ${n} attestation(s) from the topic`)).catch(() => {});
setInterval(() => syncAttestationsFromHcs().catch(() => {}), 30_000).unref?.();

serve({ fetch: app.fetch, port: env.PORT }, (i) => {
  console.log(`Proofmark gateway on http://localhost:${i.port}`);
  console.log("configured:", Object.entries(caps).map(([k, v]) => `${k}=${v ? "yes" : "no"}`).join(" "));
});
