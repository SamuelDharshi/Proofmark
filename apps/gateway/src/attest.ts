import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { toolManifestHash, type AttestationPair, type McpTool, type RegistryType } from "@proofmark/core";
import { captureTools, containerSpec, dockerAvailable, dockerPath, dockerRun, type SpawnSpec } from "@proofmark/runner";
import { getServer, packageKind, type RegistryServer } from "./registry";

export interface Derived {
  server: string;
  version: string;
  registryType: RegistryType;
  artifactHash: string;
  toolManifestHash: string;
  tools: McpTool[];
  sandboxed: boolean;
}

export async function resolveServer(name: string, version = "latest"): Promise<RegistryServer | null> {
  return getServer(name, version);
}

/** Artefact hash comes from the registry's own integrity fields. */
async function artefactHash(s: RegistryServer): Promise<{ type: RegistryType; hash: string; spec: SpawnSpec | null }> {
  const { type, pkg } = packageKind(s);
  if (type === "mcpb" && pkg?.fileSha256) return { type, hash: "0x" + pkg.fileSha256.replace(/^sha256:/, ""), spec: null };
  if (type === "oci" && pkg?.identifier) {
    const digest = pkg.identifier.match(/sha256:[a-f0-9]{64}/)?.[0];
    return { type, hash: digest ? "0x" + digest.slice(7) : "0x" + createHash("sha256").update(pkg.identifier).digest("hex"), spec: containerSpec(pkg.identifier) };
  }
  if (type === "npm" && pkg?.identifier) {
    const r = await fetch(`https://registry.npmjs.org/${pkg.identifier}/${pkg.version ?? s.version}`);
    if (!r.ok) throw new Error(`npm ${r.status} for ${pkg.identifier}`);
    const j = (await r.json()) as { dist?: { integrity?: string; shasum?: string } };
    const integrity = j.dist?.integrity ?? j.dist?.shasum;
    if (!integrity) throw new Error("npm package has no dist.integrity");
    return { type, hash: integrity, spec: null };
  }
  if (type === "pypi" && pkg?.identifier) {
    const ver = pkg.version ?? s.version;
    const r = await fetch(`https://pypi.org/pypi/${pkg.identifier}/${ver}/json`);
    if (!r.ok) throw new Error(`PyPI ${r.status} for ${pkg.identifier}`);
    const j = (await r.json()) as { urls?: { packagetype: string; digests?: { sha256?: string } }[] };
    const f = j.urls?.find((u) => u.packagetype === "bdist_wheel") ?? j.urls?.[0];
    if (!f?.digests?.sha256) throw new Error("PyPI release has no sha256 digest");
    return { type, hash: "0x" + f.digests.sha256, spec: null };
  }
  return { type: "remote", hash: "0x0", spec: null };
}

/** Install an npm package inside a container, then return a spec that runs it offline. */
function npmOfflineSpec(identifier: string, version: string): SpawnSpec {
  const dir = mkdtempSync(join(tmpdir(), "proofmark-npm-"));
  const install = dockerRun(["run", "--rm", "-v", `${dockerPath(dir)}:/app`, "-w", "/app", "node:22-slim", "npm", "install", "--no-audit", "--no-fund", `${identifier}@${version}`]);
  if (install.status !== 0) throw new Error(`npm install in container failed: ${install.stderr.slice(0, 300)}`);
  const pkg = JSON.parse(readFileSync(join(dir, "node_modules", identifier, "package.json"), "utf8"));
  const bin = typeof pkg.bin === "string" ? pkg.bin : Object.values(pkg.bin ?? {})[0];
  if (!bin) throw new Error("package exposes no bin");
  const base = containerSpec("node:22-slim");
  return {
    command: base.command,
    args: [...base.args.slice(0, -1).filter((a) => a !== "node:22-slim"), "-v", `${dockerPath(dir)}:/app:ro`, "-w", "/app", "node:22-slim", "node", `node_modules/${identifier}/${bin}`],
  };
}

/** Derive the manifest: verify hash, run hermetically, capture tools/list ourselves. */
export async function deriveAttestation(name: string, version = "latest"): Promise<Derived> {
  const s = await resolveServer(name, version);
  if (!s) throw new Error(`server ${name} not found in the registry`);
  const a = await artefactHash(s);
  if (a.type === "remote") throw new Error("hosted remotes have no artefact to derive a manifest from");
  let spec = a.spec;
  if (!spec && a.type === "npm") {
    if (!dockerAvailable()) throw new Error("npm servers need a container runtime to attest");
    const { pkg } = packageKind(s);
    spec = npmOfflineSpec(pkg!.identifier!, pkg!.version ?? s.version);
  }
  if (!spec && a.type === "pypi") throw new Error("PyPI servers verify their digest, but running them hermetically needs the two-phase container install, which is not built yet. Use an OCI, mcpb or npm server.");
  if (!spec) throw new Error(`${a.type} servers are not attestable yet`);
  if (a.type === "oci" && !dockerAvailable()) throw new Error("container runtime unavailable");
  const tools = await captureTools(spec);
  return {
    server: s.name,
    version: s.version,
    registryType: a.type,
    artifactHash: a.hash,
    toolManifestHash: toolManifestHash(tools),
    tools,
    sandboxed: a.type === "oci" || a.type === "npm",
  };
}

export function buildPair(d: Derived, attestKey: string, buyer: string, attestSubname?: string): AttestationPair {
  return {
    server: d.server,
    version: d.version,
    registryType: d.registryType,
    artifactHash: d.artifactHash,
    toolManifestHash: d.toolManifestHash,
    attestKey,
    attestSubname,
    revocationCheckedAt: Date.now(),
    buyer,
    validUntil: Date.now() + 24 * 60 * 60 * 1000,
  };
}

/** The artefact hash the registry itself publishes, with no container needed. Used to check a submitted attestation. */
export async function registryArtifactHash(name: string, version = "latest") {
  const s = await resolveServer(name, version);
  if (!s) throw new Error(`server ${name} not found in the registry`);
  const a = await artefactHash(s);
  return { version: s.version, registryType: a.type, hash: a.hash };
}
