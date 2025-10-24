## Battra MCP Server

A lightweight Model Context Protocol (MCP) bridge that lets local agents create and manage Battra stories, tasks, and sprints by calling the existing API gateway.

### Features
- List projects and stories
- Create stories, tasks, and sprints
- Update story/task statuses
- Fetch the active sprint for a project

### Environment Variables
| Variable | Purpose | Default |
| --- | --- | --- |
| `BATTRA_API_BASE` | Base URL for the Battra API gateway | `http://localhost:8000/api/v1` |
| `BATTRA_USER_ID` | User ID header forwarded to the API (`X-User-Id`) | _required for authenticated calls_ |
| `BATTRA_ORG_ID` | Organization ID header (`X-Organization-Id`) | optional |
| `BATTRA_AUTHORIZATION` | Authorization header (e.g., `Bearer ...`) | optional |

These mirror the headers used by the Next.js client. When running the API gateway in mock auth mode you can omit the `Authorization` header.

### Usage
Build once:

```bash
pnpm --filter @battra/mcp-server install
pnpm --filter @battra/mcp-server build
```

Run (stdio):

```bash
BATTRA_USER_ID=... BATTRA_ORG_ID=... pnpm --filter @battra/mcp-server start
```

The process speaks JSON-RPC over stdio using the MCP conventions (Content-Length–prefixed messages). Tools exposed:

- `list_projects`
- `get_project`
- `list_project_stories`
- `create_story`
- `update_story_status`
- `create_task`
- `list_story_tasks`
- `update_task_status`
- `create_sprint`
- `get_active_sprint`

Integrate it with your MCP-compatible client/agent and provide the environment variables above to forward the correct auth context.
