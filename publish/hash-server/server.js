#!/usr/bin/env node
import { createHash, timingSafeEqual } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

/** Hash text and check hashes. Pure computation: no files, no network, nothing stored. */
const ALGOS = ["sha256", "sha512", "sha3-256"];
const MAX_CHARS = 1_000_000;

function digest(text, algorithm = "sha256") {
  const algo = String(algorithm).toLowerCase();
  if (!ALGOS.includes(algo)) throw new Error(`algorithm must be one of ${ALGOS.join(", ")}.`);
  const t = String(text ?? "");
  if (t.length > MAX_CHARS) throw new Error("text is longer than 1,000,000 characters.");
  return createHash(algo).update(t, "utf8").digest("hex");
}

const tools = [
  {
    name: "hash_text",
    description: "Hash UTF-8 text with sha256 (default), sha512 or sha3-256. Returns lowercase hex.",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string" }, algorithm: { type: "string", enum: ALGOS } },
      required: ["text"],
    },
  },
  {
    name: "verify_hash",
    description: "Check whether text hashes to an expected hex digest, in constant time.",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string" }, hash: { type: "string", description: "Expected digest in hex." }, algorithm: { type: "string", enum: ALGOS } },
      required: ["text", "hash"],
    },
  },
];

const server = new Server({ name: "proofmark-hash", version: "1.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: a = {} } = req.params;
  try {
    if (name === "hash_text") return { content: [{ type: "text", text: digest(a.text, a.algorithm) }] };
    if (name === "verify_hash") {
      const got = Buffer.from(digest(a.text, a.algorithm), "hex");
      const want = Buffer.from(String(a.hash ?? "").trim().toLowerCase().replace(/^0x/, ""), "hex");
      const ok = got.length === want.length && timingSafeEqual(got, want);
      return { content: [{ type: "text", text: ok ? "match" : "no match" }] };
    }
    return { isError: true, content: [{ type: "text", text: `Unknown tool ${name}` }] };
  } catch (e) {
    return { isError: true, content: [{ type: "text", text: e.message }] };
  }
});

await server.connect(new StdioServerTransport());
process.stdin.on("end", () => process.exit(0));
process.stdin.on("close", () => process.exit(0));
