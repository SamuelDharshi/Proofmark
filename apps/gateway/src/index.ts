import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { env, caps } from "./config";
import { publicRoutes } from "./routes/public";
import { claimRoutes } from "./routes/claim";
import { attestRoutes } from "./routes/attest";

const app = new Hono();
app.use("*", cors({ origin: "*", allowHeaders: ["*"], exposeHeaders: ["*"] }));
app.route("/", publicRoutes);
app.route("/", claimRoutes);
app.route("/attest", attestRoutes);
app.onError((e, c) => {
  console.error(e);
  return c.json({ error: e.message }, 500);
});

serve({ fetch: app.fetch, port: env.PORT }, (i) => {
  console.log(`THANKS gateway on http://localhost:${i.port}`);
  console.log("configured:", Object.entries(caps).map(([k, v]) => `${k}=${v ? "yes" : "no"}`).join(" "));
});
