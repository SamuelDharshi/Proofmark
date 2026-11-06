# proofmark-files

A read-only MCP server for one folder.

Tools:

- `list_dir`: list a directory. Folders end with a slash.
- `read_file`: read a text file, up to the first 64 KB.

Every path is resolved inside `FILES_ROOT` (default: the working directory), symlinks included, so nothing outside that folder can be listed or read. The server never writes.

```json
{
  "mcpServers": {
    "files": { "command": "npx", "args": ["-y", "proofmark-files"], "env": { "FILES_ROOT": "/path/to/folder" } }
  }
}
```
