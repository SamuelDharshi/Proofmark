import { PrivateKey, TokenCreateTransaction, TokenMintTransaction, TokenSupplyType, TokenType } from "@hiero-ledger/sdk";
import { env, caps } from "./config";
import { hederaClient } from "./hcs";

/**
 * Each approved attestation is also minted as an HTS NFT, a certificate anyone can see in a wallet or on HashScan.
 * The collection is created once with `npm run hts:create`. Metadata is capped at 100 bytes by Hedera,
 * so it holds the server, the version and the start of the tool-manifest hash; the full record is on HCS.
 */
export async function createAttestationCollection() {
  const c = hederaClient();
  const key = PrivateKey.fromStringECDSA(env.HEDERA_GATEWAY_PRIVATE_KEY!);
  const tx = await new TokenCreateTransaction()
    .setTokenName("Proofmark Attestation")
    .setTokenSymbol("PMARK")
    .setTokenType(TokenType.NonFungibleUnique)
    .setSupplyType(TokenSupplyType.Infinite)
    .setTreasuryAccountId(env.HEDERA_GATEWAY_ACCOUNT_ID!)
    .setSupplyKey(key.publicKey)
    .setTokenMemo("Certificate that a verified human attested an MCP server's tool manifest")
    .execute(c);
  const receipt = await tx.getReceipt(c);
  return { tokenId: receipt.tokenId!.toString(), tx: tx.transactionId.toString() };
}

export function attestationMetadata(p: { server: string; version: string; manifestHash: string }): Uint8Array {
  const meta = (server: string) => Buffer.from(JSON.stringify({ s: server, v: p.version.slice(0, 12), h: p.manifestHash.slice(0, 18) }));
  let server = p.server;
  let buf = meta(server);
  while (buf.length > 100 && server.length > 8) buf = meta((server = server.slice(0, -4)));
  return buf;
}

export async function mintAttestation(p: { server: string; version: string; manifestHash: string }) {
  if (!caps.hts) return null;
  const c = hederaClient();
  const tx = await new TokenMintTransaction().setTokenId(env.HTS_TOKEN_ID!).addMetadata(attestationMetadata(p)).execute(c);
  const receipt = await tx.getReceipt(c);
  return { tokenId: env.HTS_TOKEN_ID!, serial: Number(receipt.serials[0]), tx: tx.transactionId.toString() };
}
