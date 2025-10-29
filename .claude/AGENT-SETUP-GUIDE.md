# Agent Setup Guide

This guide covers setting up and running autonomous agents with the Battra AI system, including the new **DevOps** and **Documenter** agents.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Available Agents](#available-agents)
4. [Quick Start](#quick-start)
5. [MCP Configuration](#mcp-configuration)
6. [Multi-Agent Setup](#multi-agent-setup)
7. [Individual Agent Usage](#individual-agent-usage)
8. [Troubleshooting](#troubleshooting)

---

## Overview

Battra supports multiple autonomous agent types that work collaboratively on sprint tasks:

- **Scrum Master (SM):** Facilitates sprints, reviews PRs, tracks blockers
- **Developer (Dev):** Implements features, writes tests, creates PRs
- **QA:** Tests features, writes test scenarios, validates PRs
- **Product Owner (PO):** Manages backlog, prioritizes stories, refines acceptance criteria
- **DevOps:** Infrastructure, deployment, CI/CD, monitoring
- **Documenter:** Technical writing, architecture docs, user guides

Each agent has its own:
- Database user with specific role and specialty
- API key for authentication
- MCP server configuration
- Git worktree for isolated work
- Skill profile for task matching

---

## Prerequisites

### 1. Database Setup

Ensure PostgreSQL is running and the Battra database is initialized:

```bash
# Start PostgreSQL (if using Docker)
docker-compose up -d postgres

# Verify connection
psql "postgres://postgres:password@localhost:5432/gamalan" -c "SELECT version();"
```

### 2. API Gateway Running

The backend API must be accessible:

```bash
# Start the API gateway
DATABASE_URL="postgres://postgres:password@localhost:5432/gamalan" \
  cargo shuttle run --port 8000

# Verify health
curl http://localhost:8000/health
```

### 3. Anthropic API Key

Each agent needs an Anthropic API key:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

---

## Available Agents

### Current Agent Users

| Agent Type   | API Key                  | User Email                      | Specialty  | Role        |
|--------------|--------------------------|----------------------------------|-----------|-------------|
| Scrum Master | battra-sm-key-1          | (managed via Clerk)             | N/A       | Product Owner |
| Developer    | battra-dev-key-1         | (varies)                        | backend   | Contributor |
| QA           | battra-qa-key-1          | (varies)                        | qa        | Contributor |
| PO           | battra-po-key-1          | (managed via Clerk)             | N/A       | Product Owner |
| Sponsor      | battra-sponsor-key-1     | (managed via Clerk)             | N/A       | Sponsor |
| **DevOps**   | **battra-devops-key-1**  | devops-agent-1@battra.local     | devops    | Contributor |
| **Documenter** | **battra-documenter-key-1** | documenter-agent-1@battra.local | fullstack | Contributor |

### Verify Agent Users

```bash
psql "postgres://postgres:password@localhost:5432/gamalan" -c \
  "SELECT token, description FROM api_keys WHERE token LIKE 'battra-%';"
```

---

## Quick Start

### Option 1: Run All Agents with Multi-Agent Script

```bash
# Set up worktrees (first time only)
./scripts/setup-agent-worktrees.sh 6  # Creates 6 agent worktrees

# Get sprint ID from API
SPRINT_ID=$(curl -s http://localhost:8000/api/v1/sprints \
  -H "X-API-Key: battra-po-key-1" | jq -r '.[0].id')

# Run all agents
./scripts/multi-agent-sprint.sh "$SPRINT_ID"
```

This starts:
- 1 Dev agent
- 1 QA agent
- 1 PO agent
- 1 DevOps agent
- 1 Documenter agent

Logs are written to `./logs/autonomous-agents/`.

### Option 2: Run Individual Agent

```bash
# Set up a single worktree
./scripts/setup-agent-worktrees.sh 1

# Navigate to worktree
cd ../agents/devops-1

# Configure and run
export BATTRA_API_KEY=battra-devops-key-1
export BATTRA_SPRINT_ID=<sprint-uuid>
export ANTHROPIC_API_KEY=<your-key>

./scripts/autonomous-agent.sh battra-devops-key-1 "$BATTRA_SPRINT_ID" devops
```

---

## MCP Configuration

MCP (Model Context Protocol) servers provide agents with access to Battra APIs through Claude Code.

### Configuration File

The MCP config is at `.claude/mcp-config.json`:

```json
{
  "mcpServers": {
    "battra-devops": {
      "command": "pnpm",
      "args": ["--filter", "@battra/mcp-server", "start"],
      "env": {
        "BATTRA_API_BASE": "http://localhost:8000/api/v1",
        "BATTRA_API_KEY": "battra-devops-key-1"
      }
    },
    "battra-documenter": {
      "command": "pnpm",
      "args": ["--filter", "@battra/mcp-server", "start"],
      "env": {
        "BATTRA_API_BASE": "http://localhost:8000/api/v1",
        "BATTRA_API_KEY": "battra-documenter-key-1"
      }
    }
  }
}
```

### Using MCP in Claude Code

When running Claude Code, specify which MCP server to use:

```bash
# For DevOps work
claude-code --mcp-config .claude/mcp-config.json --mcp-server battra-devops

# For Documentation work
claude-code --mcp-config .claude/mcp-config.json --mcp-server battra-documenter
```

### Verify MCP Setup

```bash
# Test MCP server
pnpm --filter @battra/mcp-server start &
MCP_PID=$!

# Check if server responds
# (MCP communication happens via stdio)

kill $MCP_PID
```

---

## Multi-Agent Setup

### 1. Create Agent Worktrees

```bash
# Create 6 worktrees (SM, 2 devs, QA, DevOps, Documenter)
./scripts/setup-agent-worktrees.sh 6
```

This creates:
```
../agents/
├── scrum-master/    (battra-sm-key-1)
├── dev-1/           (battra-dev-key-1)
├── dev-2/           (battra-dev-key-2 - needs creation)
├── qa-1/            (battra-qa-key-1)
├── devops-1/        (battra-devops-key-1) ✨ NEW
└── documenter-1/    (battra-documenter-key-1) ✨ NEW
```

### 2. Configure Agents

Each worktree has a `.agent-config` file:

```bash
# DevOps agent config
cd ../agents/devops-1
cat .agent-config

# Output:
# AGENT_NAME=devops-1
# AGENT_ROLE=devops
# AGENT_INDEX=4
# export BATTRA_API_KEY=battra-devops-key-1
# ...
```

Edit to add your API keys:

```bash
# Add to .agent-config
echo "export BATTRA_API_KEY=battra-devops-key-1" >> .agent-config
echo "export BATTRA_PROJECT_ID=<your-project-uuid>" >> .agent-config
echo "export BATTRA_SPRINT_ID=<your-sprint-uuid>" >> .agent-config
echo "export ANTHROPIC_API_KEY=<your-anthropic-key>" >> .agent-config
```

### 3. Run Multi-Agent Sprint

```bash
# From main repo
./scripts/multi-agent-sprint.sh <sprint-uuid>
```

Monitor logs in separate terminals:

```bash
# Terminal 1: DevOps logs
tail -f ./logs/autonomous-agents/devops-agent.log

# Terminal 2: Documenter logs
tail -f ./logs/autonomous-agents/documenter-agent.log

# Terminal 3: All logs
tail -f ./logs/autonomous-agents/*.log
```

### 4. Stop All Agents

```bash
# Ctrl+C in the terminal running multi-agent-sprint.sh
# Or kill the process:
pkill -f multi-agent-sprint.sh
```

---

## Individual Agent Usage

### DevOps Agent

**Purpose:** Handle infrastructure, deployment, and platform work

**Skill Profile:**
- rust, shuttle, github-actions, postgres, docker, bash
- monitoring, security, networking, performance

**Example Tasks:**
- Configure Shuttle deployment
- Set up CI/CD pipelines
- Implement health checks
- Database migrations
- Monitoring setup

**Launch:**

```bash
cd ../agents/devops-1
source .agent-config

./scripts/autonomous-agent.sh \
  battra-devops-key-1 \
  <sprint-uuid> \
  devops
```

**Task Selection:**
The DevOps agent prioritizes:
1. Infrastructure blockers (tasks blocking dev/qa work)
2. Production issues (deployment failures, security)
3. Enabler stories (platform work for upcoming features)

**Persona Guide:** See `.claude/personas/devops-agent.md`

---

### Documenter Agent

**Purpose:** Create and maintain documentation, architecture records, user guides

**Skill Profile:**
- technical-writing, markdown, architecture, api-design
- typescript, rust, diagrams, playwright

**Example Tasks:**
- Write ADRs for architecture changes
- Update LIVING_ARCHITECTURE.md
- Create user guides with screenshots
- Document API endpoints
- Onboarding documentation

**Launch:**

```bash
cd ../agents/documenter-1
source .agent-config

./scripts/autonomous-agent.sh \
  battra-documenter-key-1 \
  <sprint-uuid> \
  documenter
```

**Task Selection:**
The Documenter agent prioritizes:
1. Post-implementation docs (after features complete)
2. Architecture changes (capture decisions in ADRs)
3. Missing documentation (knowledge gaps)
4. User-facing guides

**Persona Guide:** See `.claude/personas/documenter-agent.md`

---

## Agent Collaboration Patterns

### 1. Sequential Work (Dev → Documenter)

```
[Dev] Implements feature → Merges PR
  ↓
[Documenter] Picks up doc task → Updates guides
  ↓
[Team] Reviews documentation PR
```

### 2. Parallel Work (Dev + DevOps)

```
[DevOps] Sets up Redis infrastructure
  ↓
[Dev] Implements pub/sub feature (using Redis)

Both work independently, merge sequentially.
```

### 3. Swarming on Blockers

```
Sprint Standup identifies blocker:
"CDN setup is blocking 3 dev tasks"

Team response:
- DevOps agent takes CDN task
- Completes in 90 minutes
- Dev agents resume blocked work
```

---

## Troubleshooting

### API Key Not Found

```
Error: 401 Unauthorized
```

**Solution:**

```bash
# Verify API key exists
psql "postgres://postgres:password@localhost:5432/gamalan" -c \
  "SELECT token FROM api_keys WHERE token = 'battra-devops-key-1';"

# If missing, run setup script
psql "postgres://postgres:password@localhost:5432/gamalan" \
  -f /tmp/create-devops-documenter-users.sql
```

### Worktree Already Exists

```
Error: worktree already exists
```

**Solution:**

```bash
# Clean up existing worktrees
./scripts/cleanup-agent-worktrees.sh

# Recreate
./scripts/setup-agent-worktrees.sh 6
```

### Agent Not Picking Up Tasks

**Check task readiness:**

```bash
curl -s "http://localhost:8000/api/v1/sprints/<sprint-id>/tasks" \
  -H "X-API-Key: battra-devops-key-1" | jq '.[] | select(.status == "ready")'
```

**Verify agent role:**

```bash
# Check if API key has correct user/role
psql "postgres://postgres:password@localhost:5432/gamalan" -c \
  "SELECT u.role, u.specialty, ak.token
   FROM api_keys ak
   JOIN users u ON u.id = ak.user_id
   WHERE ak.token = 'battra-devops-key-1';"
```

### MCP Server Not Starting

```
Error: Failed to start MCP server
```

**Solution:**

```bash
# Verify MCP package exists
pnpm list --filter @battra/mcp-server

# Rebuild if needed
pnpm --filter @battra/mcp-server build

# Test manually
pnpm --filter @battra/mcp-server start
```

### Git Worktree Issues

```
Error: worktree path is not a directory
```

**Solution:**

```bash
# List existing worktrees
git worktree list

# Remove problematic worktree
git worktree remove <path> --force

# Recreate
./scripts/setup-agent-worktrees.sh 6
```

---

## Additional Resources

- **Agent Personas:** `.claude/personas/`
- **DevOps Revised Approach:** `/tmp/devops-integration-revised.md`
- **Architecture Docs:** `docs/adr/`
- **API Documentation:** `services/*/docs/openapi.yaml`

---

## Next Steps

1. **Create additional agent users** if you need multiple DevOps or Documenter agents
2. **Configure agent skills** in persona files to match your team's needs
3. **Set up monitoring** to track agent task completion and quality
4. **Iterate on task matching** based on agent performance

For questions or issues, see the main project README or create an issue.
