# Using the Battra MCP Server from Codex CLI

Codex CLI does not speak the MCP protocol directly, but we can surface the MCP bridge as a Codex tool by wrapping its command in `codex.toml`. Below is a minimal setup you can drop next to the repository’s root so Codex can invoke Battra operations against your local stack.

## 1. Create `codex.toml`

```toml
version = 1

[tools.battra-mcp]
description = "Bridge to the Battra API via the MCP server"
command = "pnpm"
args = ["--filter", "@battra/mcp-server", "start"]
workdir = "tools/battra-mcp-server"

[tools.battra-mcp.env]
BATTRA_API_BASE = "http://localhost:8000/api/v1"
BATTRA_USER_ID = "<uuid-of-local-user>"
BATTRA_ORG_ID = "<uuid-of-local-org>"
BATTRA_API_KEY = "<api-key-token>"
```

> Keep the file in the repo root so Codex can discover it (`codex.toml` is the default lookup location).

## 2. Install & Build Once

```bash
pnpm install --filter @battra/mcp-server
pnpm --filter @battra/mcp-server build
```

This ensures the TypeScript build is ready before Codex launches the tool.

## 3. Running the Tool in Codex

Inside Codex CLI, you can now call:

```
/battra-mcp
```

Codex will spawn the MCP bridge. It stays running while you interact with Battra tools; stop it with `Ctrl+C` when done.

## 4. Exposing Sub-commands (Optional)

If you want dedicated shortcuts (e.g., `list-projects`, `create-sprint`), define wrapper tools that send JSON-RPC payloads to the MCP server. Example using `curl`:

```toml
[tools.battra-list-projects]
description = "List projects via MCP bridge"
command = "sh"
args = ["-c", "curl -s http://localhost:7777 -d '{\"jsonrpc\":\"2.0\",\"id\":\"list\",\"method\":\"battra.listProjects\"}'"]
```

Adjust the host/port to whatever the MCP server exposes.

## 5. Troubleshooting

- **Port conflicts:** if the MCP server binds to a specific port, update the wrapper tool arguments.
- **Environment:** Codex inherits the env values defined in `codex.toml`. Ensure the `BATTRA_API_KEY` matches a row in the `api_keys` table (along with the corresponding user/org IDs).
- **Dependencies:** Re-run `pnpm install --filter @battra/mcp-server` any time the package.json changes.

With this setup Codex can chain commands that call Battra via the MCP server while you keep the bridge running inside the CLI session. 
