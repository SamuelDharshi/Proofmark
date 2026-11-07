# proofmark-hash

A small MCP server that hashes text with SHA-256, SHA-512 or SHA3-256 and verifies digests in constant time.

mcp-name: io.github.SamuelDharshi/proofmark-hash

Tools:

- `hash_text`: hash UTF-8 text.
- `verify_hash`: check text against an expected digest.

Pure computation: it reads no files, opens no network connections and stores nothing.

```json
{
  "mcpServers": {
    "hash": { "command": "npx", "args": ["-y", "proofmark-hash"] }
  }
}
```

Part of [Proofmark](https://github.com/SamuelDharshi/Proofmark), the MCP trust gate. Check this server's live trust status at https://proofmark-web.vercel.app/check?server=io.github.SamuelDharshi/proofmark-hash
