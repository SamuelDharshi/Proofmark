import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { toolManifestHash, type AttestationPair, type McpTool, type RegistryType } from "@thanks/core";
import { captureTools, containerSpec, dockerAvailable, type SpawnSpec } from "@thanks/runner";
import { getServer, packageKind, type RegistryServer } from "./registry";
import { fixtureEntry, fixtureServer, isFixture } from "./fixtures";

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
  if (isFixture(name)) return fixtureServer(name);
  return getServer(name, version);
}

/** Artefact hash comes from the registry's own integrity fields. */
async function artefactHash(s: RegistryServer): Promise<{ type: RegistryType; hash: string; spec: SpawnSpec | null }> {
  if (isFixture(s.name)) {
    const entry = fixtureEntry(s.name)!;
    const hash = "0x" + createHash("sha256").update(readFileSync(entry)).digest("hex");
    return { type: "local", hash, spec: { command: "npx", args: ["tsx", entry] } };
  }
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
  return { type: "remote", hash: "0x0", spec: null };
}

/** Install an npm package inside a container, then return a spec that runs it offline. */
function npmOfflineSpec(identifier: string, version: string): SpawnSpec {
  const dir = mkdtempSync(join(tmpdir(), "thanks-npm-"));
  const install = spawnSync(
    "docker",
    ["run", "--rm", "-v", `${dir}:/app`, "-w", "/app", "node:22-slim", "npm", "install", "--no-audit", "--no-fund", `${identifier}@${version}`],
    { encoding: "utf8", timeout: 240000 },
  );
  if (install.status !== 0) throw new Error(`npm install in container failed: ${install.stderr.slice(0, 300)}`);
  const pkg = JSON.parse(readFileSync(join(dir, "node_modules", identifier, "package.json"), "utf8"));
  const bin = typeof pkg.bin === "string" ? pkg.bin : Object.values(pkg.bin ?? {})[0];
  if (!bin) throw new Error("package exposes no bin");
  const base = containerSpec("node:22-slim");
  return {
    command: "docker",
    args: [...base.args.slice(0, -1).filter((a) => a !== "node:22-slim"), "-v", `${dir}:/app:ro`, "-w", "/app", "node:22-slim", "node", `node_modules/${identifier}/${bin}`],
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
