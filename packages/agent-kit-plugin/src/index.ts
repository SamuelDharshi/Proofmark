import type { Context, Plugin, Tool } from "@hashgraph/hedera-agent-kit";
import { z } from "zod";

/**
 * Proofmark for the Hedera Agent Kit. It gives an Agent Kit agent two read-only tools so it can ask,
 * before it connects to an MCP server, whether a unique, domain-verified, bonded maintainer still stands behind it, and read
 * an agent's identity (ENS name, World Agent Pass, budget) from the gateway.
 *
 *   new HederaLangchainToolkit({ client, configuration: { plugins: [proofmarkPlugin()], context: { mode: AgentMode.AUTONOMOUS } } })
 */
const DEFAULT_GATEWAY = "https://proofmark-gateway.onrender.com";

async function get(gateway: string, path: string) {
  const r = await fetch(`${gateway}${path}`, { signal: AbortSignal.timeout(60_000) });
  const body = (await r.json().catch(() => ({}))) as Record<string, any>;
  if (!r.ok) throw new Error(body.error ?? `Proofmark gateway returned ${r.status}`);
  return body;
}

const parse = (raw: string) => {
  const v = JSON.parse(raw);
  return { raw: v, humanMessage: v.humanMessage ?? raw };
};

export function proofmarkPlugin(gateway = process.env.PROOFMARK_GATEWAY_URL ?? DEFAULT_GATEWAY): Plugin {
  const checkServer = (_ctx: Context): Tool => ({
    method: "proofmark_check_server",
    name: "PROOFMARK_CHECK_SERVER_TOOL",
    description:
      "Check an MCP server by its official registry name (for example io.github.acme/filesystem) before connecting to it. Returns the trust tier (green, sandboxed or blocked), why, and the maintainer ENS name when claimed. Free and read-only.",
    parameters: z.object({ server: z.string().describe("Registry name of the MCP server") }),
    execute: async (_client, _context, p: { server: string }) => {
      const r = await get(gateway, `/check?server=${encodeURIComponent(p.server)}`);
      return JSON.stringify({ ...r, humanMessage: `${r.server}: ${String(r.tier).toUpperCase()}. ${r.explain}` });
    },
    outputParser: parse,
  });

  const agentIdentity = (_ctx: Context): Tool => ({
    method: "proofmark_agent_identity",
    name: "PROOFMARK_AGENT_IDENTITY_TOOL",
    description:
      "Read a Proofmark agent from its ENS name (for example claude-1.agents.proofmark.eth): its World Agent Pass state, remaining x402 budget and spending ceiling. Free and read-only.",
    parameters: z.object({ ensName: z.string().describe("The agent's ENS name") }),
    execute: async (_client, _context, p: { ensName: string }) => {
      const r = await get(gateway, `/agents/${encodeURIComponent(p.ensName)}`);
      return JSON.stringify({ ...r, humanMessage: `${r.ensName}: Agent Pass ${r.pass?.valid ? "valid" : `not valid (${r.pass?.reason ?? "unknown"})`}, ${r.uaid ? "UAID " + r.uaid.split(";")[0].slice(0, 28) + "..., " : ""}budget left $${r.budgetLeft} of $${r.budgetUsd}, max risk ${r.maxRisk}.` });
    },
    outputParser: parse,
  });

  return {
    name: "proofmark",
    version: "0.1.0",
    description: "Check that a unique, domain-verified, bonded maintainer backs an MCP server, and read an agent's on-chain identity.",
    tools: (ctx) => [checkServer(ctx), agentIdentity(ctx)],
  };
}
