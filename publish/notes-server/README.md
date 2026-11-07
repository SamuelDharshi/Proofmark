# proofmark-notes

A read-only MCP server for a folder of notes. List, search and read .md and .txt files, confined to one folder.

mcp-name: io.github.SamuelDharshi/proofmark-notes

Tools:

- `list_notes`: list every note.
- `search_notes`: find notes containing some text.
- `read_note`: read one note, up to 64 KB.

Every path is resolved inside `NOTES_ROOT` (default: the working directory), symlinks included. Only `.md`, `.markdown` and `.txt` files are read. The server never writes.

```json
{
  "mcpServers": {
    "notes": { "command": "npx", "args": ["-y", "proofmark-notes"], "env": { "NOTES_ROOT": "/path/to/notes" } }
  }
}
```

Part of [Proofmark](https://github.com/SamuelDharshi/Proofmark), the MCP trust gate. Check this server's live trust status at https://proofmark-web.vercel.app/check?server=io.github.SamuelDharshi/proofmark-notes
