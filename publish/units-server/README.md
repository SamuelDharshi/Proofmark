# proofmark-units

A small MCP server that converts between units of length, mass, temperature and data size.

mcp-name: io.github.SamuelDharshi/proofmark-units

Tools:

- `convert`: convert a value between units.
- `list_units`: list the supported units.

Pure computation: it reads no files, opens no network connections and stores nothing.

```json
{
  "mcpServers": {
    "units": { "command": "npx", "args": ["-y", "proofmark-units"] }
  }
}
```

Part of [Proofmark](https://github.com/SamuelDharshi/Proofmark), the MCP trust gate. Check this server's live trust status at https://proofmark-web.vercel.app/check?server=io.github.SamuelDharshi/proofmark-units
