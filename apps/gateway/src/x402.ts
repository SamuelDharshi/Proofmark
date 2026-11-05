import type { MiddlewareHandler } from "hono";
import { HTTPFacilitatorClient } from "@x402/core/http";
import { x402ResourceServer, x402HTTPResourceServer } from "@x402/core/server";
import { ExactHederaScheme } from "@x402/hedera/exact/server";
import { paymentMiddlewareFromHTTPServer } from "@x402/hono";
import { hederaTxUrl } from "@proofmark/core";
import { env, usdToTinybars } from "./config";
import { store, uid, logEvent } from "./store";
import { anchor } from "./hcs";
import { getAgentByEvm } from "./agents";

export const NETWORK = "hedera:testnet" as const;

/** Maintainer price, capped by the gateway. */
export function priceFor(server: string): { usd: number; payTo: string } {
  const db = store.get();
  const claim = db.claims.find((c) => c.server === server);
  const org = claim && db.orgs.find((o) => o.name === claim.org);
  const usd = Math.min(org?.price ?? env.CONNECT_PRICE_USD, env.MAX_PRICE_USD);
  return { usd, payTo: org?.payTo ?? env.HEDERA_GATEWAY_ACCOUNT_ID ?? "" };
}

const q = (ctx: { adapter: { getQueryParam(n: string): string | string[] | undefined } }, name: string) => {
  const v = ctx.adapter.getQueryParam(name);
  return Array.isArray(v) ? v[0] : v ?? "";
};

const facilitator = new HTTPFacilitatorClient({ url: env.X402_FACILITATOR_URL });

const resourceServer = new x402ResourceServer(facilitator).register(
  "hedera:*",
  // Asset is configurable. HBAR by default because the testnet USDC id is not reliable on every facilitator.
  new ExactHederaScheme({ defaultAssets: { [NETWORK]: { asset: env.X402_ASSET, decimals: env.X402_ASSET === "0.0.0" ? 8 : 6 } } }),
);

/** Record every settled payment and anchor it on HCS. */
resourceServer.onAfterSettle(async (ctx) => {
  const res = ctx.result;
  if (!res.success) return;
  let server = "";
  let version = "latest";
  try {
    const u = new URL((ctx.paymentPayload as any).resource?.url ?? "");
    server = u.searchParams.get("server") ?? "";
    version = u.searchParams.get("version") ?? "latest";
  } catch {}
  const { usd, payTo } = priceFor(server);
  const payment = {
    id: uid(),
    txId: res.transaction,
    buyer: res.payer ?? "",
    server,
    version,
    amountTinybars: String((ctx.requirements as any).amount),
    usd,
    payTo,
    ts: Date.now(),
  };
  const hcs = await anchor({ type: "payment", ...payment }).catch(() => null);
  store.update((d) => {
    d.payments.unshift({ ...payment, hcs: hcs ?? undefined });
    const agent = d.agents.find((a) => a.hederaAccount === payment.buyer);
    if (agent) agent.spentUsd = +(agent.spentUsd + usd).toFixed(6);
  });
  logEvent({ kind: "payment", server, agent: payment.buyer, detail: `${usd} USD settled over x402`, tx: { chain: "hedera", id: res.transaction } });
  console.log(`[x402] settled ${res.transaction} ${hederaTxUrl(res.transaction)}`);
});

const routes = {
  "GET /attest": {
    accepts: {
      scheme: "exact",
      network: NETWORK,
      maxTimeoutSeconds: 180,
      payTo: async (ctx: any) => priceFor(q(ctx, "server")).payTo,
      price: async (ctx: any) => ({ asset: env.X402_ASSET, amount: usdToTinybars(priceFor(q(ctx, "server")).usd).toString() }),
    },
    description: "Signed attestation: artefact hash and tool-manifest hash with a live revocation check",
    mimeType: "application/json",
  },
};

const httpServer = new x402HTTPResourceServer(resourceServer, routes as any);

export const paywall: MiddlewareHandler = paymentMiddlewareFromHTTPServer(httpServer);

/** True when this buyer already paid for this server inside the 24 hour validity window. */
export function paidRecently(buyerHederaAccount: string, server: string) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return store.get().payments.some((p) => p.buyer === buyerHederaAccount && p.server === server && p.ts > cutoff);
}

export { getAgentByEvm };
