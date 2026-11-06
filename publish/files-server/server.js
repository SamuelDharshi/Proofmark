#!/usr/bin/env node
import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

/**
 * Read-only access to one folder. Every path is resolved inside FILES_ROOT (default: the working
 * directory), symlinks included, so nothing outside it can be listed or read.
 */
const ROOT = realpathSync(resolve(process.env.FILES_ROOT ?? process.cwd()));
const MAX_BYTES = 64 * 1024;

function inside(p) {
  const full = realpathSync(resolve(ROOT, String(p ?? ".")));
  if (full !== ROOT && !full.startsWith(ROOT + sep)) throw new Error("That path is outside the allowed folder.");
  return full;
}

const tools = [
  {
    name: "list_dir",
    description: "List the files and folders in a directory inside the allowed folder. Folders end with a slash.",
    inputSchema: { type: "object", properties: { path: { type: "string", description: "Directory, relative to the allowed folder. Defaults to the folder itself." } } },
  },
  {
    name: "read_file",
    description: "Read a text file inside the allowed folder. Returns at most the first 64 KB.",
    inputSchema: { type: "object", properties: { path: { type: "string", description: "File, relative to the allowed folder." } }, required: ["path"] },
  },
];

const server = new Server({ name: "proofmark-files", version: "1.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: a = {} } = req.params;
  try {
    if (name === "list_dir") {
      const dir = inside(a.path);
      const entries = readdirSync(dir, { withFileTypes: true }).map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
      return { content: [{ type: "text", text: entries.join("\n") || "(empty)" }] };
    }
    if (name === "read_file") {
      const file = inside(a.path);
      if (!statSync(file).isFile()) throw new Error("That path is not a file.");
      return { content: [{ type: "text", text: readFileSync(file).subarray(0, MAX_BYTES).toString("utf8") }] };
    }
    return { isError: true, content: [{ type: "text", text: `Unknown tool ${name}` }] };
  } catch (e) {
    return { isError: true, content: [{ type: "text", text: e.message }] };
  }
});

await server.connect(new StdioServerTransport());
process.stdin.on("end", () => process.exit(0));
process.stdin.on("close", () => process.exit(0));
