import { createAgentBookVerifier } from "@worldcoin/agentkit";
import { verifyMessage, getAddress } from "viem";
import { env } from "./config";
import { store, type Agent } from "./store";

const book = createAgentBookVerifier();

export const getAgentByEvm = (evm: string) => store.get().agents.find((a) => a.evmAddress.toLowerCase() === evm.toLowerCase());
export const getAgentByName = (name: string) => store.get().agents.find((a) => a.ensName === name);

export function upsertAgent(a: Partial<Agent> & { ensName: string; evmAddress: string; hederaAccount: string }): Agent {
  return store.update((d) => {
    const i = d.agents.findIndex((x) => x.ensName === a.ensName);
    const next: Agent = {
      budgetUsd: 1, spentUsd: 0, maxRisk: "green", allowedTools: [], passValid: true,
      ...(i >= 0 ? d.agents[i] : {}),
      ...a,
    } as Agent;
    if (i >= 0) d.agents[i] = next;
    else d.agents.push(next);
    return next;
  });
}

export interface PassStatus {
  valid: boolean;
  mode: "live" | "mock";
  humanId?: string;
  reason?: "not-registered" | "expired" | "revoked" | "unknown-agent";
  message: string;
}

/**
 * The Agent Pass gates authority to spend. It is checked before any payment,
 * so an expired or revoked pass means the payment is refused and no connection happens.
 */
export async function agentPass(evm: string): Promise<PassStatus> {
  const agent = getAgentByEvm(evm);
  const mode = env.AGENT_PASS_MODE;
  if (agent?.passExpiresAt && agent.passExpiresAt < Date.now())
    return { valid: false, mode, reason: "expired", message: "Agent Pass has expired. Spending is refused." };
  if (agent && !agent.passValid)
    return { valid: false, mode, reason: "revoked", message: "Agent Pass was revoked. Spending is refused." };
  if (mode === "mock") {
    if (!agent) return { valid: false, mode, reason: "unknown-agent", message: "Agent is not registered with this gateway." };
    return { valid: true, mode, humanId: "mock", message: "Mock Agent Pass accepted (demo mode)." };
  }
  const humanId = await book.lookupHuman(getAddress(evm));
  if (!humanId) return { valid: false, mode, reason: "not-registered", message: "This agent wallet is not registered in AgentBook." };
  return { valid: true, mode, humanId, message: "A verified human operates this agent." };
}

/** The agent proves it holds the wallet by signing the connect request. */
export async function verifyAgentRequest(h: { evm: string; ts: string; sig: string; server: string }) {
  const age = Math.abs(Date.now() - Number(h.ts));
  if (!Number.isFinite(age) || age > 120_000) return false;
  return verifyMessage({ address: getAddress(h.evm), message: `proofmark-connect:${h.server}:${h.ts}`, signature: h.sig as `0x${string}` }).catch(() => false);
}

export const budgetLeft = (a: Agent) => Math.max(0, a.budgetUsd - a.spentUsd);
