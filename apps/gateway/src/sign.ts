import { privateKeyToAccount } from "viem/accounts";
import { canonicalize, type AttestationPair } from "@thanks/core";
import { env } from "./config";

const account = () => {
  if (!env.ATTEST_PRIVATE_KEY) throw new Error("ATTEST_PRIVATE_KEY is not set");
  return privateKeyToAccount(env.ATTEST_PRIVATE_KEY as `0x${string}`);
};

export const gatewaySigner = () => account().address;

/** EIP-191 signature over the canonical JSON of the pair. */
export async function signPair(pair: AttestationPair) {
  const signature = await account().signMessage({ message: canonicalize(pair) });
  return { pair, signature, signer: account().address };
}
