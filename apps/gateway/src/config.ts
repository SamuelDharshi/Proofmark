import "dotenv/config";
import { resolve } from "node:path";
import { z } from "zod";

const emptyToUndef = (v: unknown) => (v === "" ? undefined : v);
const opt = z.preprocess(emptyToUndef, z.string().optional());

const schema = z.object({
  PORT: z.coerce.number().default(8787),
  PUBLIC_GATEWAY_URL: z.string().default("http://localhost:8787"),
  DATA_DIR: z.string().default("./data"),

  HEDERA_GATEWAY_ACCOUNT_ID: opt,
  HEDERA_GATEWAY_PRIVATE_KEY: opt,
  HCS_TOPIC_ID: opt,
  X402_FACILITATOR_URL: z.string().default("https://api.testnet.blocky402.com"),
  X402_ASSET: z.string().default("0.0.0"),
  HBAR_USD: z.coerce.number().default(0.1),
  CONNECT_PRICE_USD: z.coerce.number().default(0.002),
  MAX_PRICE_USD: z.coerce.number().default(0.05),

  AGENT_HEDERA_ACCOUNT_ID: opt,
  AGENT_HEDERA_PRIVATE_KEY: opt,
  AGENT_ENS_NAME: z.string().default("claude-1.team.eth"),

  ATTEST_PRIVATE_KEY: opt,

  SEPOLIA_RPC_URL: opt,
  ENS_ADMIN_PRIVATE_KEY: opt,
  ENS_ROOT_NAME: z.string().default("thanks.eth"),

  WORLD_APP_ID: opt,
  WORLD_RP_ID: opt,
  WORLD_RP_SIGNING_KEY: opt,
  WORLD_ENVIRONMENT: z.enum(["staging", "production"]).default("staging"),
  WORLD_ACTION: z.string().default("claim-mcp-server"),
  AGENT_PASS_MODE: z.enum(["live", "mock"]).default("live"),
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
  agent: !!(env.AGENT_HEDERA_ACCOUNT_ID && env.AGENT_HEDERA_PRIVATE_KEY),
};

export const usdToTinybars = (usd: number) => BigInt(Math.max(1, Math.round((usd / env.HBAR_USD) * 1e8)));
