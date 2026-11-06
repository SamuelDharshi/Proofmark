import { spawnSync } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { McpTool } from "@proofmark/core";

export interface SpawnSpec {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/** DOCKER_BIN lets the engine live elsewhere, e.g. "wsl -u root docker" for Docker Engine inside WSL2. */
function dockerBin(): { command: string; prefix: string[] } {
  const [command, ...prefix] = (process.env.DOCKER_BIN?.trim() || "docker").split(/\s+/);
  return { command, prefix };
}

let dockerOk: boolean | undefined;
export function dockerAvailable(): boolean {
  if (dockerOk === undefined) {
    const d = dockerBin();
    const r = spawnSync(d.command, [...d.prefix, "version", "--format", "{{.Server.Version}}"], { encoding: "utf8", timeout: 15000 });
    dockerOk = r.status === 0 && !!r.stdout.trim();
  }
  return dockerOk;
}

/** Hermetic container wrapper: no network, read-only root, no capabilities. */
export function containerSpec(image: string, extraArgs: string[] = []): SpawnSpec {
  const d = dockerBin();
  return {
    command: d.command,
    args: [
      ...d.prefix,
      "run", "--rm", "-i",
      "--network", "none",
      "--read-only",
      "--cap-drop", "ALL",
      "--security-opt", "no-new-privileges",
      "--pids-limit", "128",
      "--memory", "256m",
      image,
      ...extraArgs,
    ],
  };
}

export interface Session {
  client: Client;
  tools: McpTool[];
  onToolsChanged(cb: () => void): void;
  close(): Promise<void>;
}

/** Spawn a stdio MCP server and list its tools. */
export async function openStdio(spec: SpawnSpec, opts: { timeoutMs?: number } = {}): Promise<Session> {
  const transport = new StdioClientTransport({
    command: spec.command,
    args: spec.args,
    env: { ...(process.env as Record<string, string>), ...(spec.env ?? {}) },
    stderr: "pipe",
  });
  const client = new Client({ name: "proofmark", version: "0.1.0" }, { capabilities: {} });
  const timeout = opts.timeoutMs ?? 30000;
  await Promise.race([
    client.connect(transport),
    new Promise((_, rej) => setTimeout(() => rej(new Error("server did not start in time")), timeout)),
  ]);
  const listed = await client.listTools();
  const listeners: (() => void)[] = [];
  client.setNotificationHandler(
    (await import("@modelcontextprotocol/sdk/types.js")).ToolListChangedNotificationSchema,
    async () => listeners.forEach((l) => l()),
  );
  return {
    client,
    tools: listed.tools as McpTool[],
    onToolsChanged: (cb) => listeners.push(cb),
    close: () => client.close(),
  };
}

/** Capture the tool list the server advertises, then shut it down. */
export async function captureTools(spec: SpawnSpec): Promise<McpTool[]> {
  const s = await openStdio(spec);
  try {
    return s.tools;
  } finally {
    await s.close().catch(() => {});
  }
}
