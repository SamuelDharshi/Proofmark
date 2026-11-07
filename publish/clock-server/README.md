# proofmark-clock

A small MCP server for time: the current time in any IANA time zone, and conversion between zones.

mcp-name: io.github.SamuelDharshi/proofmark-clock

Tools:

- `now`: the current time in a time zone.
- `convert_time`: show an ISO 8601 date-time in another zone.

Pure computation: it reads no files, opens no network connections and stores nothing.

```json
{
  "mcpServers": {
    "clock": { "command": "npx", "args": ["-y", "proofmark-clock"] }
  }
}
```

Part of [Proofmark](https://github.com/SamuelDharshi/Proofmark), the MCP trust gate. Check this server's live trust status at https://proofmark-web.vercel.app/check?server=io.github.SamuelDharshi/proofmark-clock
