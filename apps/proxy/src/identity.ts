import "dotenv/config";
import { PrivateKey } from "@hiero-ledger/sdk";
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
  const client = new x402Client().register("hedera:*", new ExactHederaScheme(signer));
  return {
    ensName: process.env.AGENT_ENS_NAME ?? "claude-1.team.eth",
    hederaAccount: account,
    evmAddress: evm.address,
    sign: (message) => evm.signMessage({ message }),
    payFetch: wrapFetchWithPayment(fetch, client) as typeof fetch,
  };
}
