import { verifyMessage, getAddress } from "viem";
import { env } from "./config";
import { readAgent, type AgentRecord } from "./chain";
import { spentUsd } from "./hcs";

/**
 * Agents are ENS namespaces. Budget, risk ceiling, allowed tools and the Agent Pass binding are text
 * records on <agent>.agents.<root>. The spend total comes from the HCS payment log.
 */
export const loadAgent = (ensName: string) => readAgent(ensName);

export interface PassStatus {
  valid: boolean;
  reason?: "not-bound" | "expired" | "weak-credential";
  message: string;
  acr?: string;
  authTime?: number;
  /** Unix seconds when spend authority lapses. */
  expiresAt?: number;
  maxAgeSec: number;
}

const acceptedAcr = () => env.WORLD_IDP_ACR.split(",").map((s) => s.trim()).filter(Boolean);

/**
 * The Agent Pass gates authority to spend, not each payment. It is valid while a validated World ID
 * authentication bound to this agent is younger than the allowed age. Nothing here can be overridden:
 * it is a pure function of what is on-chain and the clock.
 */
export function passStatus(a: AgentRecord): PassStatus {
  const maxAgeSec = a.pass.maxAgeSec ?? env.PASS_MAX_AGE_SECONDS;
  if (!a.pass.sub || !a.pass.authTime)
    return { valid: false, reason: "not-bound", maxAgeSec, message: "No verified human is bound to this agent. Spending is refused." };
  const expiresAt = a.pass.authTime + maxAgeSec;
  if (Date.now() / 1000 > expiresAt)
    return { valid: false, reason: "expired", maxAgeSec, acr: a.pass.acr, authTime: a.pass.authTime, expiresAt, message: "Agent Pass has expired. Spending is refused until a human approves again." };
  if (!a.pass.acr || !acceptedAcr().includes(a.pass.acr))
    return { valid: false, reason: "weak-credential", maxAgeSec, acr: a.pass.acr, message: "The bound credential is not one this gateway accepts." };
  return { valid: true, maxAgeSec, acr: a.pass.acr, authTime: a.pass.authTime, expiresAt, message: "A verified human operates this agent." };
}

export const budgetLeft = async (a: AgentRecord) => Math.max(0, +(a.budgetUsd - (await spentUsd(a.hedera))).toFixed(6));

/** The agent proves it holds the wallet recorded on its ENS name by signing the connect request. */
export async function verifyAgentRequest(h: { evm: string; ts: string; sig: string; server: string }) {
  const age = Math.abs(Date.now() - Number(h.ts));
  if (!Number.isFinite(age) || age > 120_000) return false;
  return verifyMessage({ address: getAddress(h.evm), message: `proofmark-connect:${h.server}:${h.ts}`, signature: h.sig as `0x${string}` }).catch(() => false);
}
