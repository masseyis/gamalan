# Autonomous Agent Control UI

A simple web interface for managing autonomous development agents.

## Accessing the UI

The agent control panel is available at:

```
http://localhost:3000/admin/agents
```

**Note:** This URL is intentionally not linked from the main app navigation. Bookmark it or access it directly.

## Features

### Agent Control
- **Start/Stop individual agents**: Click the Start/Stop button on each agent card
- **View agent status**: See which agents are running and their process IDs
- **Start/Stop all agents**: Use the Quick Actions panel at the bottom

### Log Viewing
- **Real-time logs**: Click on any agent card to view its logs
- **Auto-refresh**: Logs refresh automatically every 3 seconds
- **Last 50 lines**: Shows the most recent 50 log lines by default

### Configuration

#### Sprint ID
- **Optional**: Specify a sprint ID, or leave empty to auto-detect the active sprint
- **Auto-detection**: If no sprint ID is provided, the system will automatically find the active sprint for the first team

#### Claude Invocation Method
- **Claude Code CLI** (recommended): Uses your Claude Code Plus subscription
  - No additional API costs
  - Enabled by default
  - Requires `claude` CLI to be installed
- **Anthropic API**: Uses separate API credits
  - Requires an Anthropic API key (sk-ant-...)
  - Uncheck "Use Claude Code CLI" and enter your API key
  - Useful if you want to use API credits instead of CLI

## How It Works

### Backend (API Routes)

**GET `/api/agents`**
- Returns status of all agents (running/stopped, PID, log files)
- Polls every 5 seconds in the UI

**POST `/api/agents`**
- Start or stop agents
- Body: `{ action: "start" | "stop", role: string, sprintId?: string, useCLI?: boolean, apiKey?: string }`
- Configuration options:
  - `useCLI: true` - Use Claude Code CLI (default)
  - `useCLI: false` with `apiKey` - Use Anthropic API with provided key

**GET `/api/agents/logs/[agent]?lines=N`**
- Fetch logs for a specific agent
- `lines` parameter controls how many recent lines to fetch (default: 100)

### Frontend (React Component)

- **Auto-refresh**: Status refreshes every 5s, logs every 3s
- **Click to view logs**: Click any agent card to see its output
- **Responsive grid**: Adapts to screen size (1-5 columns)

## Agent Roles

The UI manages these autonomous agents:

| Role | API Key | Purpose |
|------|---------|---------|
| **dev** | battra-dev-key-1 | Developer tasks (implementation, bug fixes) |
| **qa** | battra-qa-key-1 | QA tasks (testing, test creation) |
| **po** | battra-po-key-1 | Product Owner tasks (story refinement) |
| **devops** | battra-devops-key-1 | DevOps tasks (CI/CD, infrastructure) |
| **documenter** | battra-documenter-key-1 | Documentation tasks |

## Requirements

- Next.js app must be running (`pnpm dev`)
- Battra API must be accessible (default: `http://localhost:8000/api/v1`)
- Agent scripts must be in `scripts/` directory
- **Either**:
  - `claude` CLI installed (for Claude Code CLI mode - recommended)
  - OR valid Anthropic API key (for API mode)

## Environment Variables

The agents inherit these environment variables from the parent process:

```bash
BATTRA_API_BASE="http://localhost:8000/api/v1"
USE_WORKTREE="true"
GIT_WORKFLOW_ENABLED="true"
GIT_PR_BASE_BRANCH="main"
MAX_ITERATIONS="0"  # Infinite
POLL_INTERVAL="30"
```

### Claude Invocation (Configured via UI)

The Claude invocation method is configured through the UI Configuration panel:
- **Default**: Uses Claude Code CLI (no environment variables needed)
- **Custom**: You can switch to Anthropic API and provide your API key directly in the UI
- The UI settings are passed to the backend when starting agents
- No need to set `USE_CLAUDE_CLI` or `ANTHROPIC_API_KEY` in your environment

## Troubleshooting

### Agents won't start
- Check that `scripts/autonomous-agent.sh` exists and is executable
- Verify Battra API is running: `curl http://localhost:8000/api/v1/teams`
- Check the browser console for errors

### No logs showing
- Agents may not have started yet
- Check if log files exist: `ls -la ../../logs/autonomous-agents/`
- Verify log directory permissions

### "Failed to auto-detect sprint"
- Provide a sprint ID manually in the Configuration panel
- Or ensure you have an active sprint in the Battra API

## Files Created

```
apps/web/app/
├── admin/agents/
│   ├── page.tsx              # Main UI component
│   └── README.md             # This file
└── api/agents/
    ├── route.ts              # Start/stop/status API
    └── logs/[agent]/
        └── route.ts          # Log fetching API
```

## Security Note

This UI is not protected by authentication in this initial version. Consider adding authentication middleware if deploying to production:

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // Add your auth check here
  }
}
```
