export const HASHSCAN = "https://hashscan.io";
export type Net = "testnet" | "mainnet";

/** Hedera tx id 0.0.1@1700000000.123 -> HashScan form 0.0.1-1700000000-000000123 */
export function hederaTxPath(id: string) {
  const m = id.match(/^(\d+\.\d+\.\d+)@(\d+)\.(\d+)$/);
  return m ? `${m[1]}-${m[2]}-${m[3].padStart(9, "0")}` : id;
}
export const hederaTxUrl = (id: string, net: Net = "testnet") => `${HASHSCAN}/${net}/transaction/${hederaTxPath(id)}`;
export const hederaAccountUrl = (id: string, net: Net = "testnet") => `${HASHSCAN}/${net}/account/${id}`;
export const hederaTopicUrl = (id: string, net: Net = "testnet") => `${HASHSCAN}/${net}/topic/${id}`;
export const hederaTokenUrl = (id: string, net: Net = "testnet") => `${HASHSCAN}/${net}/token/${id}`;

/** Explorer map keyed by EVM chain id. */
export const EVM_EXPLORERS: Record<number, string> = {
  11155111: "https://sepolia.etherscan.io",
  480: "https://worldscan.org",
};
export const evmTxUrl = (chainId: number, hash: string) => `${EVM_EXPLORERS[chainId]}/tx/${hash}`;
export const evmAddressUrl = (chainId: number, addr: string) => `${EVM_EXPLORERS[chainId]}/address/${addr}`;
export const ensAppUrl = (name: string) => `https://sepolia.app.ens.domains/${name}`;
