# Multi-Agent Development with Git Worktrees

This guide explains how to run multiple autonomous agents concurrently using git worktrees, allowing true parallel development without conflicts.

---

## Overview

Git worktrees allow multiple working directories to coexist, each with its own branch, while sharing the same `.git` directory. This enables multiple agents to work simultaneously without stepping on each other's toes.

### Architecture

```
gamalan/ai-agile/           # Main repository
├── .git/                   # Shared git database
├── services/               # Main working tree
├── apps/
└── scripts/

../agents/                  # Worktree base directory
├── scrum-master/           # Worktree 1 (on scrum-master-workspace branch)
│   ├── services/
│   ├── apps/
│   └── .agent-config
├── dev-1/                  # Worktree 2 (on dev-1-workspace branch)
│   ├── services/
│   └── .agent-config
├── dev-2/                  # Worktree 3 (on dev-2-workspace branch)
└── qa-1/                   # Worktree 4 (on qa-1-workspace branch)
```

---

## Quick Start

### 1. Set Up Worktrees

From your main repository:

```bash
cd /Users/jamesmassey/ai-dev/gamalan/ai-agile

# Create 4 agent worktrees (1 SM + 2 devs + 1 QA)
./scripts/setup-agent-worktrees.sh 4

# Or create custom number
./scripts/setup-agent-worktrees.sh 6  # For 6 agents
```

This creates:
- `../agents/scrum-master/` - Scrum Master worktree
- `../agents/dev-1/` - Dev Agent 1 worktree
- `../agents/dev-2/` - Dev Agent 2 worktree
- `../agents/qa-1/` - QA Agent worktree

### 2. Configure Each Agent

Each worktree has a `.agent-config` file. Edit it with your credentials:

```bash
cd ../agents/dev-1
nano .agent-config
```

Add your API keys:

```bash
# API Configuration
export BATTRA_API_KEY=battra-dev-key-1
export BATTRA_PROJECT_ID=35299584-b133-4b20-af2d-446bb1dead6a
export BATTRA_SPRINT_ID=<your-sprint-uuid>
export ANTHROPIC_API_KEY=sk-ant-...

# Git Configuration (already set)
export GIT_WORKFLOW_ENABLED=true
export GIT_PR_BASE_BRANCH=main
```

### 3. Start Agents

Open separate terminals for each agent:

**Terminal 1 - Scrum Master:**
```bash
cd ../agents/scrum-master
source .agent-config
export BATTRA_API_KEY=battra-sm-key-1
export BATTRA_PROJECT_ID=35299584-b133-4b20-af2d-446bb1dead6a
export ANTHROPIC_API_KEY=sk-ant-...
./scripts/scrummaster-agent.sh
```

**Terminal 2 - Dev Agent 1:**
```bash
cd ../agents/dev-1
source .agent-config
export BATTRA_API_KEY=battra-dev-key-1
export BATTRA_SPRINT_ID=<sprint-uuid>
export ANTHROPIC_API_KEY=sk-ant-...
./scripts/autonomous-agent.sh battra-dev-key-1 <sprint-uuid> dev
```

**Terminal 3 - Dev Agent 2:**
```bash
cd ../agents/dev-2
source .agent-config
export BATTRA_API_KEY=battra-dev-key-2
export BATTRA_SPRINT_ID=<sprint-uuid>
export ANTHROPIC_API_KEY=sk-ant-...
./scripts/autonomous-agent.sh battra-dev-key-2 <sprint-uuid> dev
```

**Terminal 4 - QA Agent:**
```bash
cd ../agents/qa-1
source .agent-config
export BATTRA_API_KEY=battra-qa-key-1
export BATTRA_SPRINT_ID=<sprint-uuid>
export ANTHROPIC_API_KEY=sk-ant-...
./scripts/autonomous-agent.sh battra-qa-key-1 <sprint-uuid> qa
```

---

## How It Works

### Branch Workflow

Each agent:

1. **Starts on dedicated workspace branch** (e.g., `dev-1-workspace`)
2. **Creates task branch** (e.g., `task/abc-123-add-login`)
3. **Works on the task** (isolated in worktree)
4. **Commits changes** (conventional commits)
5. **Pushes branch** to remote
6. **Creates PR** to merge into `main`
7. **Waits for CI/review** (optional auto-merge)
8. **Returns to workspace branch** after merge

### Concurrent Execution

```
Agent Dev-1:  dev-1-workspace → task/abc-123 → PR → merge → dev-1-workspace
                                  ↓ (working)
Agent Dev-2:  dev-2-workspace → task/def-456 → PR → merge → dev-2-workspace
                                       ↓ (working)
Agent QA-1:   qa-1-workspace → task/ghi-789 → PR → merge → qa-1-workspace
```

All agents work simultaneously without conflicts because:
- Each worktree is isolated
- Each creates unique branch names
- Merges happen sequentially through PRs

### Worktree Detection

The executor automatically detects worktrees:

```javascript
// claude-code-executor-with-git.js

async function checkIfWorktree() {
  const gitDirResult = await execCommand('git', ['rev-parse', '--git-dir']);
  const gitDir = gitDirResult.stdout.trim();

  // Worktrees have git dir like '../.git/worktrees/agent-name'
  return gitDir.includes('/worktrees/');
}
```

When in a worktree, the executor:
- Skips `git checkout main` (already on workspace branch)
- Pulls latest changes from main directly
- Creates task branch from current state

---

## Management Commands

### View Worktrees

```bash
cd /Users/jamesmassey/ai-dev/gamalan/ai-agile
git worktree list
```

Output:
```
/Users/jamesmassey/ai-dev/gamalan/ai-agile           abc1234 [main]
/Users/jamesmassey/ai-dev/gamalan/agents/scrum-master  abc1234 [scrum-master-workspace]
/Users/jamesmassey/ai-dev/gamalan/agents/dev-1          abc1234 [dev-1-workspace]
/Users/jamesmassey/ai-dev/gamalan/agents/dev-2          abc1234 [dev-2-workspace]
/Users/jamesmassey/ai-dev/gamalan/agents/qa-1           abc1234 [qa-1-workspace]
```

### Add New Worktree

```bash
# Add a new dev agent
git worktree add -B dev-3-workspace ../agents/dev-3 main

# Configure it
cp ../agents/dev-1/.agent-config ../agents/dev-3/
# Edit ../agents/dev-3/.agent-config with new API key
```

### Remove Single Worktree

```bash
# From main repo
cd /Users/jamesmassey/ai-dev/gamalan/ai-agile
git worktree remove ../agents/dev-2
```

### Clean Up All Worktrees

```bash
# Interactive cleanup (asks for confirmation)
./scripts/cleanup-agent-worktrees.sh

# Force cleanup (no confirmation)
./scripts/cleanup-agent-worktrees.sh --force
```

This removes all agent worktrees but preserves the main repository.

---

## Advantages Over Separate Clones

| Aspect | Separate Clones | Git Worktrees |
|--------|----------------|---------------|
| **Disk Space** | 3-4x repository size | 1x (shared .git) |
| **Setup Time** | Clone for each agent | Single setup script |
| **Updates** | Pull in each clone | Shared git database |
| **Management** | Manual per clone | Centralized commands |
| **Performance** | Independent | Shared object cache |

### Disk Space Comparison

**Separate Clones:**
```
Main repo:  500 MB
Clone 1:    500 MB
Clone 2:    500 MB
Clone 3:    500 MB
Total:     2000 MB (2 GB)
```

**Worktrees:**
```
Main repo:  500 MB (.git)
Worktree 1:  50 MB (working files only)
Worktree 2:  50 MB
Worktree 3:  50 MB
Total:      650 MB
```

**Savings: ~70% less disk space**

---

## Troubleshooting

### Issue: "fatal: 'main' is already checked out"

**Problem:** Trying to create worktree on a branch that's already checked out.

**Solution:** Each worktree must be on a different branch. The setup script creates unique workspace branches (e.g., `dev-1-workspace`) for each agent automatically.

### Issue: Worktree shows as "locked"

**Problem:** Worktree was removed improperly.

**Solution:**
```bash
# Prune stale worktree metadata
git worktree prune

# Or unlock manually
git worktree unlock <path>
```

### Issue: Agent can't pull changes

**Problem:** Git credentials not configured in worktree.

**Solution:** Credentials are shared from main repo's .git, so configure once:
```bash
cd /Users/jamesmassey/ai-dev/gamalan/ai-agile
git config credential.helper store
```

### Issue: Merge conflicts between agents

**Problem:** Two agents modified same files.

**Solution:** This is expected! PRs will show conflicts. Options:
1. Let human reviewer resolve
2. Have agent rebase on latest main and retry
3. Use `AUTO_MERGE=false` to require human approval

---

## Best Practices

### 1. Start Fresh Each Sprint

```bash
# Clean up old worktrees
./scripts/cleanup-agent-worktrees.sh --force

# Set up fresh worktrees
./scripts/setup-agent-worktrees.sh 4
```

### 2. Monitor Agent Activity

Use `git worktree list` to see which branches agents are working on:

```bash
watch -n 5 'git worktree list'
```

### 3. Limit Concurrent Agents

Start with 2-3 agents to avoid overwhelming PRs:
- 1 Scrum Master
- 2 Dev agents
- 1 QA agent (optional)

Scale up as you get comfortable with the workflow.

### 4. Use Different Anthropic Keys

Track costs per agent:

```bash
# Dev Agent 1
export ANTHROPIC_API_KEY=sk-ant-dev1-...

# Dev Agent 2
export ANTHROPIC_API_KEY=sk-ant-dev2-...
```

### 5. Review PRs Regularly

Don't let PRs pile up. Set up GitHub notifications or use:

```bash
gh pr list --state open
```

---

## Advanced: Custom Worktree Layouts

### Option 1: Agent-Specific Directories

```bash
mkdir -p ~/autonomous-agents/battra
cd ~/autonomous-agents/battra

# Main repo
git clone <repo-url> main
cd main

# Create worktrees
./scripts/setup-agent-worktrees.sh 6
```

### Option 2: Shared Agent Pool

Multiple projects sharing agent pool:

```bash
~/agents/
├── pool-1/  # Available for any project
├── pool-2/
└── pool-3/

# Assign to project
cd ~/projects/battra
git worktree add ~/agents/pool-1 main
```

### Option 3: Kubernetes/Docker Deployment

Each agent runs in a container with mounted worktree:

```yaml
# docker-compose.yml
services:
  dev-agent-1:
    image: battra-agent:latest
    volumes:
      - ../agents/dev-1:/workspace
    environment:
      - BATTRA_API_KEY=battra-dev-key-1
```

---

## Cleanup and Maintenance

### Regular Cleanup

```bash
# Weekly: Remove merged branches
git branch --merged | grep -v main | xargs git branch -d

# Monthly: Prune worktree metadata
git worktree prune

# As needed: Clean up all worktrees
./scripts/cleanup-agent-worktrees.sh
```

### Full Reset

```bash
# Stop all agents (Ctrl+C in each terminal)

# Clean up worktrees
./scripts/cleanup-agent-worktrees.sh --force

# Reset main repo to clean state
git checkout main
git pull origin main
git clean -fdx

# Start fresh
./scripts/setup-agent-worktrees.sh 4
```

---

## Summary

**Git worktrees enable true multi-agent parallelism:**

✅ Multiple agents work simultaneously
✅ No conflicts during development
✅ Shared .git saves disk space (70% savings)
✅ Easy setup with provided scripts
✅ Works with existing git workflow
✅ CI/CD validates all changes
✅ PRs provide merge coordination

**Get started:**
```bash
./scripts/setup-agent-worktrees.sh 4
cd ../agents/dev-1
source .agent-config
# Set API keys and run agent
```

Happy autonomous development! 🤖🚀
