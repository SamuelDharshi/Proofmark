// Starts each new server and calls every tool through a real MCP client. Run from the repo root.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const NOTES = process.argv[2];
const cases = {
  "notes-server": [["list_notes", {}], ["search_notes", { query: "gates" }], ["read_note", { path: "demo.md" }], ["read_note", { path: "../outside.md" }]],
  "clock-server": [["now", { timeZone: "Asia/Kolkata" }], ["convert_time", { time: "2026-11-07T09:30:00Z", to: "Asia/Kolkata" }], ["now", { timeZone: "Mars/Base" }]],
  "hash-server": [["hash_text", { text: "proofmark" }], ["verify_hash", { text: "abc", hash: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" }], ["hash_text", { text: "x", algorithm: "md5" }]],
  "units-server": [["convert", { value: 5, from: "km", to: "mi" }], ["convert", { value: 100, from: "C", to: "F" }], ["convert", { value: 1, from: "GiB", to: "MB" }], ["convert", { value: 1, from: "kg", to: "m" }]],
};
for (const [dir, calls] of Object.entries(cases)) {
  const t = new StdioClientTransport({ command: "node", args: [`publish/${dir}/server.js`], env: { ...process.env, NOTES_ROOT: NOTES } });
  const c = new Client({ name: "smoke", version: "1" });
  await c.connect(t);
  const { tools } = await c.listTools();
  console.log(`\n${dir}: tools ${tools.map((x) => x.name).join(", ")}`);
  for (const [n, a] of calls) {
    const r = await c.callTool({ name: n, arguments: a });
    console.log(`  ${r.isError ? "ERR" : "ok "} ${n}(${JSON.stringify(a)}) -> ${r.content[0].text.replace(/\n/g, " | ").slice(0, 110)}`);
  }
  await c.close();
}
