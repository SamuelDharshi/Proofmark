/** What Proofmark can say about a server name, resolved from the official MCP registry. */
export interface ServerPackageInfo {
  registryType: string;
  identifier?: string;
  version?: string;
  /** Integrity value from the registry or the package host. */
  hash?: string;
  /** Where that value came from, e.g. "npm dist.integrity". */
  hashSource?: string;
}

export interface Signal {
  label: string;
  level: "info" | "warn";
}

export interface ServerInfo {
  /** False when the name is not in the official registry. Nothing can be attested or launched then. */
  found: boolean;
  source: "registry" | "demo" | "none";
  name: string;
  title?: string;
  description?: string;
  version?: string;
  publishedAt?: string;
  ageDays?: number;
  repository?: string;
  kind?: string;
  packages: ServerPackageInfo[];
  remotes: { type: string; url: string }[];
  ownership?: { ok: boolean; method: string; detail: string };
  signals: Signal[];
  /** What the proxy would really do with this server on the gateway host. */
  launch: { mode: "container" | "refused" | "remote-only" | "verified"; detail: string };
  /** Close real names, offered when the name is not found. */
  suggestions: { name: string; title?: string; description?: string; version?: string }[];
}
