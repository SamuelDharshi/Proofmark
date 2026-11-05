import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrivateKey } from "@hiero-ledger/sdk";

// Always read the repo-root .env, whichever folder the agent client launches the proxy from.
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });
import { privateKeyToAccount } from "viem/accounts";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { createClientHederaSigner } from "@x402/hedera";
import { ExactHederaScheme } from "@x402/hedera/exact/client";

export interface Identity {
  ensName: string;
  hederaAccount: string;
  evmAddress: `0x${string}`;
  sign(message: string): Promise<`0x${string}`>;
  payFetch: typeof fetch;
}

/**
 * One ECDSA key is both the Hedera payer and the EVM identity registered for the World Agent Pass.
 */
export function loadIdentity(): Identity {
  const account = process.env.AGENT_HEDERA_ACCOUNT_ID;
  const key = process.env.AGENT_HEDERA_PRIVATE_KEY;
  if (!account || !key) throw new Error("AGENT_HEDERA_ACCOUNT_ID and AGENT_HEDERA_PRIVATE_KEY are required");
  const hk = PrivateKey.fromStringECDSA(key);
  const evm = privateKeyToAccount(`0x${hk.toStringRaw()}`);
  const signer = createClientHederaSigner(account, hk, { network: "hedera:testnet" });
  // Spend controls: allow exactly the configured asset on Hedera testnet, capped per payment at the
  // gateway's maximum price. This is what lets an agent pay with no human in the loop safely.
  const asset = process.env.X402_ASSET ?? "0.0.0";
  const hbarUsd = Number(process.env.HBAR_USD ?? 0.1);
  const maxUsd = Number(process.env.MAX_PRICE_USD ?? 0.05);
  const decimals = asset === "0.0.0" ? 1e8 : 1e6;
  const cap = String(Math.ceil((maxUsd / (asset === "0.0.0" ? hbarUsd : 1)) * decimals));
  const client = new x402Client()
    .register("hedera:*", new ExactHederaScheme(signer))
    .setSpendControls({ allowedAssets: [{ network: "hedera:testnet", asset, maxAmountPerPayment: cap }] });
  return {
    ensName: process.env.AGENT_ENS_NAME ?? "claude-1.team.eth",
    hederaAccount: account,
    evmAddress: evm.address,
    sign: (message) => evm.signMessage({ message }),
    payFetch: wrapFetchWithPayment(fetch, client) as typeof fetch,
  };
}
