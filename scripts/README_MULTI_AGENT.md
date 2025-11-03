# Multi-Agent Sprint Workflow

This document explains how to use the multi-agent autonomous workflow for executing sprint tasks.

## Overview

The multi-agent workflow allows you to run multiple AI agents (dev, qa, po, devops, documenter) to work on sprint tasks autonomously. Each agent:
- Works in its own isolated git worktree
- Creates task-specific branches for each task
- Executes tasks using Claude Code
- Runs tests and quality checks
- Creates pull requests when tasks are complete

## Execution Modes

### Round-Robin Mode (Default - Recommended)

Agents execute **one at a time** in rotation. This is the default mode and **saves Claude usage** by running only one agent at a time.

```bash
./scripts/multi-agent-sprint.sh [sprint-id]
```

**Examples:**
```bash
# Auto-detect active sprint (recommended)
./scripts/multi-agent-sprint.sh

# Use specific sprint
./scripts/multi-agent-sprint.sh ef3dcf23-2b01-4220-9639-526e2909571a
```

**How it works:**
1. Agent 1 (dev) picks up and completes 1 task
2. Agent 2 (qa) picks up and completes 1 task
3. Agent 3 (po) picks up and completes 1 task
4. Agent 4 (devops) picks up and completes 1 task
5. Agent 5 (documenter) picks up and completes 1 task
6. Loop back to Agent 1, repeat until no tasks remain

**Benefits:**
- ✅ Lower Claude API usage (one agent at a time)
- ✅ Easier to monitor and debug
- ✅ More predictable resource consumption
- ❌ Slower overall completion time

### Parallel Mode

All agents run **simultaneously**. Use this when you want faster completion and have ample Claude usage quota.

```bash
./scripts/multi-agent-sprint.sh --parallel [sprint-id]
```

**Examples:**
```bash
# Auto-detect active sprint + parallel mode
./scripts/multi-agent-sprint.sh --parallel

# Specific sprint + parallel mode
./scripts/multi-agent-sprint.sh --parallel ef3dcf23-2b01-4220-9639-526e2909571a
```

**How it works:**
All 5 agents run concurrently, each continuously polling for tasks and executing them as they become available.

**Benefits:**
- ✅ Faster overall completion (5x potential throughput)
- ❌ Higher Claude API usage (5 agents running simultaneously)
- ❌ Harder to monitor (multiple concurrent streams)

## Prerequisites

1. **API Server Running:** The Battra API must be running on `http://localhost:8000`
   ```bash
   cargo shuttle run --port 8000
   ```

2. **API Keys Configured:** Ensure you have the following API keys in your database:
   - `battra-dev-key-1` (Developer role)
   - `battra-qa-key-1` (QA role)
   - `battra-po-key-1` (Product Owner role)
   - `battra-devops-key-1` (DevOps role)
   - `battra-documenter-key-1` (Documenter role)

3. **Active Sprint:** You need an active sprint with tasks (the script will auto-detect it, or you can specify a sprint ID manually)

4. **GitHub CLI:** The `gh` CLI must be installed and authenticated for PR creation
   ```bash
   gh auth login
   ```

## What Happens During Execution

For each task, the agent:

1. **Picks up a task** from the sprint based on role/title matching
2. **Takes ownership** of the task via the API
3. **Creates a worktree** under `../agents/tasks/task-<id>/`
4. **Creates a branch** named `<role>/task-<id>-<slug>`
5. **Invokes Claude Code** to implement the task
6. **Runs tests** (auto-detects frontend vs backend)
7. **Fixes test failures** (up to 3 retry attempts)
8. **Runs quality checks** (fmt, clippy)
9. **Commits changes** with task metadata
10. **Pushes to remote** branch
11. **Creates a Pull Request** to main
12. **Marks task complete** via the API
13. **Cleans up worktree**

## Monitoring & Debugging

### Enable Verbose Mode (Recommended for Debugging)

Show real-time agent output while they work:

```bash
# Verbose mode - see everything happening in real-time
./scripts/multi-agent-sprint.sh --verbose

# Debug mode - verbose + bash tracing
./scripts/multi-agent-sprint.sh --debug
```

### View logs in real-time:

```bash
# Quick helper - tail all logs at once
./scripts/tail-agent-logs.sh

# Or tail specific agent logs:
tail -f ./logs/autonomous-agents/dev-agent.log
tail -f ./logs/autonomous-agents/qa-agent.log
tail -f ./logs/autonomous-agents/po-agent.log
tail -f ./logs/autonomous-agents/devops-agent.log
tail -f ./logs/autonomous-agents/documenter-agent.log

# Or all logs:
tail -f ./logs/autonomous-agents/*.log
```

## Stopping Agents

Press `Ctrl+C` in the terminal where the orchestrator is running. This will gracefully stop all agents.

## Agent Worktrees

Agents work in isolated worktrees under `../agents/`:
```
../agents/
  ├── dev-1/        # Dev agent's workspace
  ├── qa-1/         # QA agent's workspace
  ├── po-1/         # PO agent's workspace
  ├── devops-1/     # DevOps agent's workspace
  └── documenter-1/ # Documenter agent's workspace
```

Within each agent's workspace, task-specific worktrees are created temporarily:
```
../agents/tasks/
  ├── task-abc12345/  # Temporary worktree for task abc12345
  └── task-def67890/  # Temporary worktree for task def67890
```

These task worktrees are **automatically cleaned up** after the PR is created.

## Cleanup

To manually clean up agent worktrees:

```bash
./scripts/cleanup-agent-worktrees.sh
```

This removes all agent worktrees and branches. Run this if you need to reset the workspace.

## Environment Variables

You can customize behavior with these environment variables:

```bash
# API configuration
export BATTRA_API_BASE="http://localhost:8000/api/v1"

# Claude invocation method (choose one)
# Option 1: Auto-detect (default)
# - If ANTHROPIC_API_KEY is set → uses API
# - If ANTHROPIC_API_KEY is NOT set → uses Claude Code CLI

# Option 2: Force Claude Code CLI (ignores ANTHROPIC_API_KEY)
export USE_CLAUDE_CLI="true"

# Option 3: Force Anthropic API (requires ANTHROPIC_API_KEY)
export USE_CLAUDE_API="true"
export ANTHROPIC_API_KEY="sk-ant-..."

# Worktree location
export WORKTREE_BASE="../agents"

# Test retry configuration
export MAX_FIX_RETRIES="3"      # Number of attempts to fix test failures

# Round-robin settings
export POLL_INTERVAL="5"        # Seconds between polls in round-robin
export MAX_ITERATIONS="1"       # Tasks per agent per round

# Parallel mode settings
export POLL_INTERVAL="30"       # Seconds between polls in parallel mode
export MAX_ITERATIONS="0"       # 0 = infinite in parallel mode
```

### Claude Invocation Options

The executor can use either Claude Code CLI or the Anthropic API:

| Method | Cost | Speed | Setup Required |
|--------|------|-------|----------------|
| **Claude Code CLI** | Included with Claude Code Plus subscription | Fast | `claude` CLI must be installed |
| **Anthropic API** | Separate API credits | Fast | `ANTHROPIC_API_KEY` required |

**How to choose:**

```bash
# Use Claude Code CLI (recommended for Claude Code Plus users)
export USE_CLAUDE_CLI="true"
./scripts/multi-agent-sprint.sh

# Use Anthropic API (for separate API credits)
export USE_CLAUDE_API="true"
export ANTHROPIC_API_KEY="sk-ant-..."
./scripts/multi-agent-sprint.sh

# Auto-detect (default)
# - Automatically uses CLI if no API key is set
# - Automatically uses API if ANTHROPIC_API_KEY is set
./scripts/multi-agent-sprint.sh
```

## Troubleshooting

### Agents not finding tasks

**Symptoms:** Agents keep reporting "No tasks available"

**Solutions:**
1. Verify the sprint has tasks: `curl http://localhost:8000/api/v1/sprints/<sprint-id>/tasks -H "X-API-Key: battra-dev-key-1"`
2. Check that tasks are in `available` status
3. Ensure tasks have no owner assigned
4. Verify API keys have correct roles

### Worktree conflicts

**Symptoms:** Error creating worktree or "already exists" errors

**Solutions:**
```bash
# List current worktrees
git worktree list

# Remove all agent worktrees
./scripts/cleanup-agent-worktrees.sh

# Try again
./scripts/multi-agent-sprint.sh <sprint-id>
```

### PR creation fails

**Symptoms:** "Failed to create pull request"

**Solutions:**
1. Ensure `gh` CLI is authenticated: `gh auth status`
2. Check you have push access to the repository
3. Verify the base branch exists: `git branch -a | grep main`

### Tests failing repeatedly

**Symptoms:** Agent gives up after 3 fix attempts

**Solutions:**
1. Check the test output in the agent log
2. The task may be too complex or ambiguous
3. Try manually implementing the task to understand the issue
4. Release the task: `curl -X DELETE http://localhost:8000/api/v1/tasks/<task-id>/ownership -H "X-API-Key: <api-key>"`

## Tips for Best Results

1. **Use Round-Robin by default** - Saves money and is easier to debug
2. **Write clear task descriptions** - The better the task description, the better Claude performs
3. **Link acceptance criteria** - Tasks with AC references produce better results
4. **Monitor logs** - Keep an eye on the logs to catch issues early
5. **Start small** - Test with 2-3 tasks before running a full sprint
6. **Clean up regularly** - Run cleanup script between test runs

## Example Full Workflow

```bash
# 1. Start the API
cargo shuttle run --port 8000

# 2. Run agents in round-robin mode (auto-detects active sprint)
./scripts/multi-agent-sprint.sh

# 3. Monitor progress
tail -f ./logs/autonomous-agents/*.log

# 4. Wait for completion or press Ctrl+C to stop

# 5. Review PRs on GitHub
gh pr list

# 6. Clean up (optional)
./scripts/cleanup-agent-worktrees.sh
```

## Advanced: Running Specific Agents

You can also run individual agents manually for testing:

```bash
cd ../agents/dev-1
export BATTRA_API_KEY="battra-dev-key-1"
export ANTHROPIC_API_KEY="<your-key>"  # Optional - uses Claude Code CLI if not set

# The script will auto-detect the active sprint
./scripts/autonomous-agent.sh battra-dev-key-1 "" dev

# Or specify a sprint manually
./scripts/autonomous-agent.sh battra-dev-key-1 <sprint-id> dev
```

This gives you more control for testing and debugging specific agents.

## Auto-Detection Details

The script auto-detects the active sprint by:
1. Querying the API for teams: `GET /api/v1/teams`
2. Using the first team found
3. Getting that team's active sprint: `GET /api/v1/teams/{team_id}/sprints/active`
4. Using that sprint ID for the workflow

If you have multiple teams or want to specify a different sprint, you can always pass the sprint ID manually.
