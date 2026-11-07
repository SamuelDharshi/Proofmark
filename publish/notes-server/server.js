#!/usr/bin/env node
import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

/**
 * Read-only access to a folder of notes (.md and .txt). Every path is resolved inside NOTES_ROOT
 * (default: the working directory), symlinks included. The server never writes.
 */
const ROOT = realpathSync(resolve(process.env.NOTES_ROOT ?? process.cwd()));
const EXT = new Set([".md", ".markdown", ".txt"]);
const MAX_BYTES = 64 * 1024;
const MAX_FILES = 2000;

function inside(p) {
  const full = realpathSync(resolve(ROOT, String(p ?? ".")));
  if (full !== ROOT && !full.startsWith(ROOT + sep)) throw new Error("That path is outside the notes folder.");
  return full;
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (out.length >= MAX_FILES || e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && EXT.has(extname(e.name).toLowerCase())) out.push(p);
  }
  return out;
}

const tools = [
  {
    name: "list_notes",
    description: "List every note (.md, .markdown or .txt) in the notes folder, as paths relative to it.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "search_notes",
    description: "Find notes containing some text, case-insensitive. Returns each matching path with the first matching line.",
    inputSchema: { type: "object", properties: { query: { type: "string", description: "Text to look for." } }, required: ["query"] },
  },
  {
    name: "read_note",
    description: "Read one note inside the notes folder. Returns at most the first 64 KB.",
    inputSchema: { type: "object", properties: { path: { type: "string", description: "Note path, relative to the notes folder." } }, required: ["path"] },
  },
];

const server = new Server({ name: "proofmark-notes", version: "1.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: a = {} } = req.params;
  try {
    if (name === "list_notes") {
      const files = walk(ROOT).map((f) => relative(ROOT, f).split(sep).join("/"));
      return { content: [{ type: "text", text: files.join("\n") || "(no notes)" }] };
    }
    if (name === "search_notes") {
      const q = String(a.query ?? "").toLowerCase();
      if (!q) throw new Error("query is required.");
      const hits = [];
      for (const f of walk(ROOT)) {
        const line = readFileSync(f).subarray(0, MAX_BYTES).toString("utf8").split(/\r?\n/).find((l) => l.toLowerCase().includes(q));
        if (line !== undefined) hits.push(`${relative(ROOT, f).split(sep).join("/")}: ${line.trim().slice(0, 200)}`);
      }
      return { content: [{ type: "text", text: hits.join("\n") || "No notes match." }] };
    }
    if (name === "read_note") {
      const file = inside(a.path);
      if (!statSync(file).isFile() || !EXT.has(extname(file).toLowerCase())) throw new Error("That path is not a note.");
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
