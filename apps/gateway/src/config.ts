import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Always read the repo-root .env, whichever folder npm runs the script from.
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });
import { z } from "zod";

const emptyToUndef = (v: unknown) => (v === "" ? undefined : v);
const opt = z.preprocess(emptyToUndef, z.string().optional());

/** EVM keys: wallets export 64 hex characters, viem wants the 0x prefix. Accept both. */
const evmKey = z.preprocess(
  (v) => (v === "" ? undefined : typeof v === "string" && /^[0-9a-fA-F]{64}$/.test(v.trim()) ? `0x${v.trim()}` : v),
  z.string().regex(/^0x[0-9a-fA-F]{64}$/, "must be a 32-byte hex private key").optional(),
);
/** Hedera ECDSA keys: the SDK wants raw hex, so drop a leading 0x. */
const hederaKey = z.preprocess((v) => (v === "" ? undefined : typeof v === "string" ? v.trim().replace(/^0x/, "") : v), z.string().optional());

const schema = z.object({
  PORT: z.coerce.number().default(8787),
  PUBLIC_GATEWAY_URL: z.string().default("http://localhost:8787"),
  DATA_DIR: z.string().default("./data"),

  HEDERA_GATEWAY_ACCOUNT_ID: opt,
  HEDERA_GATEWAY_PRIVATE_KEY: hederaKey,
  HCS_TOPIC_ID: opt,
  X402_FACILITATOR_URL: z.string().default("https://api.testnet.blocky402.com"),
  X402_ASSET: z.string().default("0.0.0"),
  HBAR_USD: z.coerce.number().default(0.1),
  CONNECT_PRICE_USD: z.coerce.number().default(0.002),
  MAX_PRICE_USD: z.coerce.number().default(0.05),

  AGENT_HEDERA_ACCOUNT_ID: opt,
  AGENT_HEDERA_PRIVATE_KEY: opt,
  AGENT_ENS_NAME: z.string().default("claude-1.team.eth"),

  ATTEST_PRIVATE_KEY: evmKey,

  SEPOLIA_RPC_URL: opt,
  ENS_ADMIN_PRIVATE_KEY: evmKey,
  ENS_ROOT_NAME: z.string().default("proofmark.eth"),

  WORLD_APP_ID: opt,
  WORLD_RP_ID: opt,
  WORLD_RP_SIGNING_KEY: opt,
  WORLD_ENVIRONMENT: z.enum(["staging", "production"]).default("staging"),
  WORLD_ACTION: z.string().default("claim-mcp-server"),
  // World ID Agent Pass: the official World IdP (OpenID Connect). Use https://sandbox.auth.world.org for the sandbox.
  WORLD_IDP_ISSUER: z.string().default("https://auth.world.org"),
  WORLD_IDP_CLIENT_ID: opt,
  WORLD_IDP_CLIENT_SECRET: opt,
  WORLD_IDP_AUTH_METHOD: z.enum(["basic", "post"]).default("basic"),
  /** How old a World ID authentication may be before spend authority lapses. */
  PASS_MAX_AGE_SECONDS: z.coerce.number().default(86400),
  /** Credential classes accepted for an agent's human, comma separated. */
  WORLD_IDP_ACR: z.string().default("https://world.org/oidc/acr/orb,https://world.org/oidc/acr/orb-face"),
  WORLD_CHAIN_RPC_URL: z.string().default("https://worldchain-mainnet.g.alchemy.com/public"),
});

export const env = schema.parse(process.env);
export const dataDir = resolve(process.cwd(), env.DATA_DIR);

/** What is configured. Features that lack credentials report "not configured" instead of faking a result. */
export const caps = {
  hedera: !!(env.HEDERA_GATEWAY_ACCOUNT_ID && env.HEDERA_GATEWAY_PRIVATE_KEY),
  hcs: !!(env.HEDERA_GATEWAY_ACCOUNT_ID && env.HEDERA_GATEWAY_PRIVATE_KEY && env.HCS_TOPIC_ID),
  signing: !!env.ATTEST_PRIVATE_KEY,
  ens: !!(env.SEPOLIA_RPC_URL && env.ENS_ADMIN_PRIVATE_KEY),
  world: !!(env.WORLD_APP_ID && env.WORLD_RP_ID && env.WORLD_RP_SIGNING_KEY),
  agentPass: !!(env.WORLD_IDP_CLIENT_ID && env.WORLD_IDP_CLIENT_SECRET),
};

export const usdToTinybars = (usd: number) => BigInt(Math.max(1, Math.round((usd / env.HBAR_USD) * 1e8)));
