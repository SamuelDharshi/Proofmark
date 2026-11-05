import { createHash } from "node:crypto";

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
  [k: string]: unknown;
}

/** Fields that change between runs and must never affect the hash. */
const VOLATILE_KEYS = new Set(["_meta", "annotations", "title", "icons", "outputSchema", "$schema"]);

function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strip);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as object).sort()) {
      if (VOLATILE_KEYS.has(k)) continue;
      const v = (value as Record<string, unknown>)[k];
      if (v === undefined) continue;
      out[k] = strip(v);
    }
    return out;
  }
  if (typeof value === "string") return value.normalize("NFC").replace(/\r\n/g, "\n").trim();
  return value;
}

/** Deterministic JSON: sorted keys, no whitespace, volatile fields removed. */
export function canonicalize(value: unknown): string {
  return JSON.stringify(strip(value));
}

export const sha256 = (s: string | Buffer) => "0x" + createHash("sha256").update(s).digest("hex");

/** Canonical view of one tool: only what defines its capability surface. */
export function canonicalTool(t: McpTool) {
  return { name: t.name, description: t.description ?? "", inputSchema: t.inputSchema ?? {} };
}

export function canonicalManifest(tools: McpTool[]): string {
  const sorted = tools.map(canonicalTool).sort((a, b) => a.name.localeCompare(b.name));
  return canonicalize(sorted);
}

export function toolManifestHash(tools: McpTool[]): string {
  return sha256(canonicalManifest(tools));
}

export interface ManifestDiff {
  added: string[];
  removed: string[];
  changed: { name: string; fields: ("description" | "inputSchema")[] }[];
}

export function diffManifests(attested: McpTool[], observed: McpTool[]): ManifestDiff {
  const a = new Map(attested.map((t) => [t.name, canonicalTool(t)]));
  const b = new Map(observed.map((t) => [t.name, canonicalTool(t)]));
  const diff: ManifestDiff = { added: [], removed: [], changed: [] };
  for (const name of b.keys()) if (!a.has(name)) diff.added.push(name);
  for (const name of a.keys()) if (!b.has(name)) diff.removed.push(name);
  for (const [name, ta] of a) {
    const tb = b.get(name);
    if (!tb) continue;
    const fields: ("description" | "inputSchema")[] = [];
    if (canonicalize(ta.description) !== canonicalize(tb.description)) fields.push("description");
    if (canonicalize(ta.inputSchema) !== canonicalize(tb.inputSchema)) fields.push("inputSchema");
    if (fields.length) diff.changed.push({ name, fields });
  }
  return diff;
}
