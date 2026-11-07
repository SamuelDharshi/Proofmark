#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

/** Time and time zones. Pure computation: no files, no network, nothing stored. */
function fmt(date, timeZone) {
  try {
    const f = new Intl.DateTimeFormat("en-GB", { timeZone, dateStyle: "full", timeStyle: "long" });
    return f.format(date);
  } catch {
    throw new Error(`Unknown time zone "${timeZone}". Use an IANA name such as Asia/Kolkata or UTC.`);
  }
}

const tools = [
  {
    name: "now",
    description: "The current date and time in a time zone (IANA name, for example Asia/Kolkata). Defaults to UTC.",
    inputSchema: { type: "object", properties: { timeZone: { type: "string", description: "IANA time zone. Defaults to UTC." } } },
  },
  {
    name: "convert_time",
    description: "Show an ISO 8601 date-time (with an offset or Z) in another time zone.",
    inputSchema: {
      type: "object",
      properties: {
        time: { type: "string", description: "ISO 8601 date-time, for example 2026-11-07T09:30:00+05:30." },
        to: { type: "string", description: "IANA time zone to show it in." },
      },
      required: ["time", "to"],
    },
  },
];

const server = new Server({ name: "proofmark-clock", version: "1.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: a = {} } = req.params;
  try {
    if (name === "now") {
      const tz = a.timeZone ? String(a.timeZone) : "UTC";
      const d = new Date();
      return { content: [{ type: "text", text: `${fmt(d, tz)}\nISO (UTC): ${d.toISOString()}` }] };
    }
    if (name === "convert_time") {
      const d = new Date(String(a.time ?? ""));
      if (Number.isNaN(d.getTime())) throw new Error("time must be an ISO 8601 date-time, for example 2026-11-07T09:30:00Z.");
      return { content: [{ type: "text", text: fmt(d, String(a.to)) }] };
    }
    return { isError: true, content: [{ type: "text", text: `Unknown tool ${name}` }] };
  } catch (e) {
    return { isError: true, content: [{ type: "text", text: e.message }] };
  }
});

await server.connect(new StdioServerTransport());
process.stdin.on("end", () => process.exit(0));
process.stdin.on("close", () => process.exit(0));
