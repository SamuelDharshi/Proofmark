import { AccountAllowanceApproveTransaction, Hbar } from "@hiero-ledger/sdk";
import { env } from "./config";
import { hederaClient } from "./hcs";
import type { AgentRecord } from "./chain";

/**
 * Spend authority as a Hedera allowance. The operator approves a capped HBAR allowance from their account to the
 * agent's account on-chain. Before any payment the gateway reads that allowance from the mirror node, next to the
 * World Agent Pass. If the operator sets it to zero, the agent stops paying on the next request.
 *
 * Be exact about what this is: the x402 payment itself settles from the agent's own account. The allowance is the
 * operator's on-chain, capped, revocable authority, and the gate that decides whether the agent may pay at all.
 * An agent whose ENS name has no `operator` record is not subject to this gate.
 */
const MIRROR = "https://testnet.mirrornode.hedera.com/api/v1";
const TINY = 1e8;

export interface AllowanceStatus {
  required: boolean;
  valid: boolean;
  operator?: string;
  grantedHbar?: number;
  remainingHbar?: number;
  message: string;
}

export async function allowanceStatus(agent: AgentRecord, needHbar = 0): Promise<AllowanceStatus> {
  if (!agent.operator) return { required: false, valid: true, message: "No operator allowance is required for this agent." };
  const r = await fetch(`${MIRROR}/accounts/${agent.operator}/allowances/crypto?spender.id=${agent.hedera}&limit=1`, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!r || !r.ok) return { required: true, valid: false, operator: agent.operator, message: "The allowance could not be read from the mirror node, so spending is refused." };
  const j = (await r.json()) as { allowances?: { amount: number; amount_granted: number }[] };
  const a = j.allowances?.[0];
  const remaining = (a?.amount ?? 0) / TINY;
  const granted = (a?.amount_granted ?? 0) / TINY;
  if (!a || a.amount <= 0) return { required: true, valid: false, operator: agent.operator, grantedHbar: granted, remainingHbar: 0, message: `${agent.operator} has no allowance for this agent. Spending is refused.` };
  if (remaining < needHbar) return { required: true, valid: false, operator: agent.operator, grantedHbar: granted, remainingHbar: remaining, message: `The allowance has ${remaining} HBAR left and this payment needs ${needHbar}.` };
  return { required: true, valid: true, operator: agent.operator, grantedHbar: granted, remainingHbar: remaining, message: `${remaining} of ${granted} HBAR allowance remaining.` };
}

/** The operator is the gateway account in this deployment, so its key signs the approval. An amount of 0 withdraws it. */
export async function setAllowance(spender: string, hbar: number) {
  const c = hederaClient();
  const tx = await new AccountAllowanceApproveTransaction().approveHbarAllowance(env.HEDERA_GATEWAY_ACCOUNT_ID!, spender, new Hbar(hbar)).execute(c);
  await tx.getReceipt(c);
  return tx.transactionId.toString();
}

export const hbarFor = (usd: number) => usd / env.HBAR_USD;
