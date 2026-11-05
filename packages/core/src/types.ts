import type { McpTool } from "./canonical";

export type RegistryType = "mcpb" | "oci" | "npm" | "pypi" | "remote" | "local";

export interface AttestationPair {
  server: string;
  version: string;
  registryType: RegistryType;
  artifactHash: string;
  toolManifestHash: string;
  attestKey: string; // EVM address that signed
  attestSubname?: string; // co-maintainer ENS name
  revocationCheckedAt: number;
  buyer: string;
  validUntil: number;
}

export interface SignedAttestation {
  pair: AttestationPair;
  signature: string;
  signer: string;
}

export interface CheckResult {
  server: string;
  version?: string;
  tier: "green" | "sandboxed" | "blocked";
  reason: string;
  explain: string;
  claimed: boolean;
  org?: string;
  payTo?: string;
  price?: number;
  worldVerified?: boolean;
  attestKey?: string;
  artifactHash?: string;
  toolManifestHash?: string;
  tools?: McpTool[];
  hcsTopic?: string;
  hcsSequence?: number;
  checkedAt: number;
}
