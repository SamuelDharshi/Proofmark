#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

/** Unit conversion. Pure computation: no files, no network, nothing stored. */
const LINEAR = {
  length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, yd: 0.9144, ft: 0.3048, in: 0.0254 },
  mass: { kg: 1, g: 0.001, mg: 1e-6, t: 1000, lb: 0.45359237, oz: 0.028349523125 },
  data: { B: 1, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12, KiB: 1024, MiB: 1024 ** 2, GiB: 1024 ** 3, TiB: 1024 ** 4 },
};
const TEMP = ["C", "F", "K"];

function kindOf(u) {
  for (const [k, table] of Object.entries(LINEAR)) if (u in table) return k;
  if (TEMP.includes(u)) return "temperature";
  return null;
}

function toKelvin(v, u) {
  return u === "K" ? v : u === "C" ? v + 273.15 : (v - 32) * (5 / 9) + 273.15;
}
function fromKelvin(v, u) {
  return u === "K" ? v : u === "C" ? v - 273.15 : (v - 273.15) * (9 / 5) + 32;
}

function convert(value, from, to) {
  const v = Number(value);
  if (!Number.isFinite(v)) throw new Error("value must be a number.");
  const kf = kindOf(from);
  const kt = kindOf(to);
  if (!kf || !kt) throw new Error(`Unknown unit. Use list_units to see what is supported.`);
  if (kf !== kt) throw new Error(`Cannot convert ${kf} to ${kt}.`);
  if (kf === "temperature") return fromKelvin(toKelvin(v, from), to);
  return (v * LINEAR[kf][from]) / LINEAR[kf][to];
}

const tools = [
  {
    name: "convert",
    description: "Convert a value between units of length, mass, temperature or data size, for example 5 km to mi.",
    inputSchema: {
      type: "object",
      properties: { value: { type: "number" }, from: { type: "string" }, to: { type: "string" } },
      required: ["value", "from", "to"],
    },
  },
  { name: "list_units", description: "List the supported units, grouped by kind.", inputSchema: { type: "object", properties: {} } },
];

const server = new Server({ name: "proofmark-units", version: "1.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: a = {} } = req.params;
  try {
    if (name === "convert") {
      const r = convert(a.value, String(a.from), String(a.to));
      return { content: [{ type: "text", text: `${a.value} ${a.from} = ${Number(r.toPrecision(12))} ${a.to}` }] };
    }
    if (name === "list_units") {
      const lines = [...Object.entries(LINEAR).map(([k, t]) => `${k}: ${Object.keys(t).join(", ")}`), `temperature: ${TEMP.join(", ")}`];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
    return { isError: true, content: [{ type: "text", text: `Unknown tool ${name}` }] };
  } catch (e) {
    return { isError: true, content: [{ type: "text", text: e.message }] };
  }
});

await server.connect(new StdioServerTransport());
process.stdin.on("end", () => process.exit(0));
process.stdin.on("close", () => process.exit(0));
