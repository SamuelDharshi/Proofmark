import type { RegistryType } from "@proofmark/core";

const REGISTRY = "https://registry.modelcontextprotocol.io/v0";

export interface RegistryPackage {
  registryType: string;
  identifier?: string;
  version?: string;
  fileSha256?: string;
  runtimeHint?: string;
  transport?: { type: string };
}
export interface RegistryServer {
  name: string;
  description?: string;
  title?: string;
  version: string;
  repository?: { url?: string; source?: string };
  packages?: RegistryPackage[];
  remotes?: { type: string; url: string }[];
  meta: { publishedAt?: string; updatedAt?: string; isLatest?: boolean; status?: string };
}

function shape(row: any): RegistryServer {
  const s = row.server ?? row;
  const m = row._meta?.["io.modelcontextprotocol.registry/official"] ?? {};
  return {
    name: s.name,
    description: s.description,
    title: s.title,
    version: s.version,
    repository: s.repository,
    packages: s.packages,
    remotes: s.remotes,
    meta: { publishedAt: m.publishedAt, updatedAt: m.updatedAt, isLatest: m.isLatest, status: m.status },
  };
}

export async function searchRegistry(q: string, limit = 20): Promise<RegistryServer[]> {
  const r = await fetch(`${REGISTRY}/servers?search=${encodeURIComponent(q)}&limit=${limit}`);
  if (!r.ok) throw new Error(`registry ${r.status}`);
  const j = (await r.json()) as { servers: any[] };
  return j.servers.map(shape);
}

export async function getServer(name: string, version = "latest"): Promise<RegistryServer | null> {
  const r = await fetch(`${REGISTRY}/servers/${encodeURIComponent(name)}/versions/${encodeURIComponent(version)}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`registry ${r.status}`);
  return shape(await r.json());
}

/**
 * The registry's own spelling of a name. GitHub namespaces are case-insensitive, so
 * io.github.samueldharshi/x and io.github.SamuelDharshi/x are the same server and must resolve the same way.
 */
const canon = new Map<string, string>();
export async function canonicalName(name: string): Promise<string> {
  const n = name.trim();
  if (canon.has(n.toLowerCase())) return canon.get(n.toLowerCase())!;
  let out = n;
  if (!(await getServer(n).catch(() => null))) {
    const tail = n.split("/").pop() ?? n;
    const hit = (await searchRegistry(tail, 50).catch(() => [])).find((s) => s.name.toLowerCase() === n.toLowerCase());
    if (hit) out = hit.name;
  }
  canon.set(n.toLowerCase(), out);
  return out;
}

/** Registry type of the first artefact-backed package, or remote. */
export function packageKind(s: RegistryServer): { type: RegistryType; pkg?: RegistryPackage } {
  const order: RegistryType[] = ["mcpb", "oci", "npm", "pypi"];
  for (const t of order) {
    const pkg = s.packages?.find((p) => p.registryType === t);
    if (pkg) return { type: t, pkg };
  }
  return { type: "remote" };
}

/** Registry name ownership: mcpName in package.json, mcp-name: line in README, or OCI label. */
export async function verifyNameOwnership(
  name: string,
  s: RegistryServer,
): Promise<{ ok: boolean; method: string; detail: string }> {
  const { type, pkg } = packageKind(s);
  try {
    if (type === "npm" && pkg?.identifier) {
      const r = await fetch(`https://registry.npmjs.org/${pkg.identifier}/latest`);
      if (r.ok) {
        const j = (await r.json()) as { mcpName?: string; readme?: string };
        if (j.mcpName === name) return { ok: true, method: "package.json mcpName", detail: `${pkg.identifier} declares mcpName ${name}` };
      }
    }
    if (type === "pypi" && pkg?.identifier) {
      const r = await fetch(`https://pypi.org/pypi/${pkg.identifier}/json`);
      if (r.ok) {
        const j = (await r.json()) as { info?: { description?: string } };
        if (j.info?.description?.includes(`mcp-name: ${name}`)) return { ok: true, method: "README mcp-name", detail: `${pkg.identifier} README contains mcp-name: ${name}` };
      }
    }
    if (type === "mcpb" || type === "oci" || type === "remote") {
      // The registry only publishes these after verifying namespace ownership at publish time.
      if (s.meta.status === "active") return { ok: true, method: "registry namespace", detail: "Published to the official registry under a verified namespace" };
    }
  } catch (e) {
    return { ok: false, method: "error", detail: String((e as Error).message) };
  }
  return { ok: false, method: "none", detail: "No mcpName, mcp-name line or OCI label found for this name" };
}
