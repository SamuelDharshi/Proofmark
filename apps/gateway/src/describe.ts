import { findTyposquat, type ServerInfo, type ServerPackageInfo, type Signal } from "@proofmark/core";
import { dockerAvailable } from "@proofmark/runner";
import { canonicalName, getServer, packageKind, searchRegistry, verifyNameOwnership, type RegistryPackage, type RegistryServer } from "./registry";
import { store } from "./store";

const TTL = 5 * 60 * 1000;
const cache = new Map<string, { t: number; v: ServerInfo }>();

const get = async (url: string) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  return r.ok ? r.json() : null;
};

/** Integrity value from the registry entry or, for npm and PyPI, from the package host itself. */
async function integrity(p: RegistryPackage, fallbackVersion: string): Promise<ServerPackageInfo> {
  const base: ServerPackageInfo = { registryType: p.registryType, identifier: p.identifier, version: p.version ?? fallbackVersion };
  try {
    if (p.registryType === "mcpb" && p.fileSha256) return { ...base, hash: p.fileSha256, hashSource: "registry fileSha256" };
    if (p.registryType === "oci") {
      const d = p.identifier?.match(/sha256:[a-f0-9]{64}/)?.[0];
      return d ? { ...base, hash: d, hashSource: "OCI digest" } : base;
    }
    if (p.registryType === "npm" && p.identifier) {
      const j = await get(`https://registry.npmjs.org/${p.identifier}/${base.version}`);
      const h = j?.dist?.integrity ?? j?.dist?.shasum;
      return h ? { ...base, hash: h, hashSource: "npm dist.integrity" } : base;
    }
    if (p.registryType === "pypi" && p.identifier) {
      const j = await get(`https://pypi.org/pypi/${p.identifier}/${base.version}/json`);
      const f = j?.urls?.find((u: any) => u.packagetype === "bdist_wheel") ?? j?.urls?.[0];
      const h = f?.digests?.sha256;
      return h ? { ...base, hash: "sha256:" + h, hashSource: "PyPI digest" } : base;
    }
  } catch {
    /* leave the hash empty rather than guess */
  }
  return base;
}

function signalsFor(name: string, s: RegistryServer, kind: string, pkgs: ServerPackageInfo[], ageDays?: number): Signal[] {
  const out: Signal[] = [];
  if (ageDays !== undefined) out.push(ageDays < 30 ? { level: "warn", label: `Published ${ageDays} day${ageDays === 1 ? "" : "s"} ago` } : { level: "info", label: `Published ${ageDays} days ago` });
  const squat = findTyposquat(name, store.get().claims.map((c) => c.server));
  if (squat) out.push({ level: "warn", label: `One or two edits from the claimed server ${squat}` });
  if (kind === "remote") out.push({ level: "warn", label: "Hosted remote: liveness and identity only, no integrity guarantee" });
  else if (!pkgs.some((p) => p.hash)) out.push({ level: "warn", label: "No integrity hash available for the artefact" });
  if (kind === "npm") out.push({ level: "info", label: "npm install scripts run before any tool is listed, so it needs a container" });
  if (!s.repository?.url) out.push({ level: "warn", label: "No source repository listed" });
  return out;
}

const empty = (name: string): ServerInfo => ({ found: false, source: "none", name, packages: [], remotes: [], signals: [], launch: { mode: "refused", detail: "" }, suggestions: [] });

export async function describeServer(input: string): Promise<ServerInfo> {
  const name = await canonicalName(input);
  const hit = cache.get(name);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  const v = await build(name);
  cache.set(name, { t: Date.now(), v });
  return v;
}

async function build(name: string): Promise<ServerInfo> {
  const s = await getServer(name).catch(() => null);
  if (!s) {
    // Not in the registry. Offer real, close names instead of pretending this one exists.
    const leaf = name.split("/").pop() ?? name;
    const found = await searchRegistry(leaf, 6).catch(() => []);
    const seen = new Set<string>();
    const suggestions = found.filter((x) => (seen.has(x.name) ? false : seen.add(x.name))).slice(0, 5).map((x) => ({ name: x.name, title: x.title, description: x.description, version: x.version }));
    return { ...empty(name), suggestions, launch: { mode: "refused", detail: "Not in the official MCP registry. There is no artefact to hash or launch." } };
  }

  const { type } = packageKind(s);
  const pkgs = await Promise.all((s.packages ?? []).slice(0, 3).map((p) => integrity(p, s.version)));
  const ageDays = s.meta.publishedAt ? Math.max(0, Math.floor((Date.now() - Date.parse(s.meta.publishedAt)) / 86_400_000)) : undefined;
  const ownership = await verifyNameOwnership(name, s).catch(() => undefined);

  let launch: ServerInfo["launch"];
  if (type === "remote") launch = { mode: "remote-only", detail: "Hosted endpoint. Nothing to run locally. Proofmark checks liveness, identity and revocation only." };
  else if (dockerAvailable()) launch = { mode: "container", detail: "Unclaimed servers run in a container with no network, a read-only filesystem and read-only tools." };
  else launch = { mode: "refused", detail: "No container runtime on this machine, so an unclaimed server is refused locally instead of launched." };

  return {
    found: true, source: "registry", name,
    title: s.title, description: s.description, version: s.version,
    publishedAt: s.meta.publishedAt, ageDays, repository: s.repository?.url, kind: type,
    packages: pkgs, remotes: s.remotes ?? [], ownership,
    signals: signalsFor(name, s, type, pkgs, ageDays), launch, suggestions: [],
  };
}
