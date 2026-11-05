import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { RegistryServer } from "./registry";

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(here, "../../..");

interface Fixture {
  name: string;
  title: string;
  description: string;
  version: string;
  source: "local-fixture";
  entry: string;
}

const path = resolve(here, "../fixtures/servers.json");
export const fixtures: Fixture[] = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : [];

export const isFixture = (name: string) => fixtures.some((f) => f.name === name);
export const fixtureEntry = (name: string) => {
  const f = fixtures.find((x) => x.name === name);
  return f ? resolve(repoRoot, f.entry) : null;
};

export function fixtureServer(name: string): RegistryServer | null {
  const f = fixtures.find((x) => x.name === name);
  if (!f) return null;
  return { name: f.name, title: f.title, description: f.description, version: f.version, meta: { status: "active", isLatest: true } };
}
