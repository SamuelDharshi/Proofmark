import { env } from "./config";

/**
 * The maintainer bond. A deposit in HBAR from the org's payout account to the bond account, checked on the
 * mirror node. It is held in a two-key account today and the gateway is trusted to mark it forfeited, which is
 * said plainly in the docs. Escrow in a contract or HTS is the next step.
 */
const MIRROR = "https://testnet.mirrornode.hedera.com/api/v1";

export const bondInfo = () => ({ account: env.BOND_ACCOUNT_ID ?? null, minHbar: env.BOND_MIN_HBAR });

/** Accepts 0.0.1@1.2, 0.0.1-1-2 or a HashScan link, and returns the mirror node path form. */
export function normalizeTxId(input: string): string {
  const raw = input.trim().split("/").pop()!.split("?")[0];
  return raw.replace("@", "-").replace(/\.(\d+)$/, "-$1");
}

export async function verifyBond(txId: string, from: string): Promise<{ ok: boolean; detail: string; hbar?: number; txId?: string }> {
  if (!env.BOND_ACCOUNT_ID) return { ok: false, detail: "This gateway has no bond account configured." };
  const id = normalizeTxId(txId);
  const r = await fetch(`${MIRROR}/transactions/${id}`, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (!r || !r.ok) return { ok: false, detail: `Transaction ${id} was not found on the mirror node yet. Wait a few seconds and try again.` };
  const j = (await r.json()) as { transactions?: { result: string; name: string; transfers: { account: string; amount: number }[] }[] };
  const t = j.transactions?.find((x) => x.result === "SUCCESS");
  if (!t) return { ok: false, detail: "That transaction did not succeed." };
  const toBond = t.transfers.filter((x) => x.account === env.BOND_ACCOUNT_ID && x.amount > 0).reduce((a, x) => a + x.amount, 0);
  const fromOut = t.transfers.filter((x) => x.account === from && x.amount < 0).reduce((a, x) => a - x.amount, 0);
  const hbar = toBond / 1e8;
  if (toBond === 0) return { ok: false, detail: `That transaction did not pay the bond account ${env.BOND_ACCOUNT_ID}.` };
  if (fromOut < toBond) return { ok: false, detail: `The deposit must come from the org's payout account ${from}.` };
  if (hbar < env.BOND_MIN_HBAR) return { ok: false, detail: `The bond is ${hbar} HBAR, the minimum is ${env.BOND_MIN_HBAR}.` };
  return { ok: true, detail: `${hbar} HBAR from ${from} to ${env.BOND_ACCOUNT_ID}`, hbar, txId: id };
}
