# Git Worktree Guide for Multi-Agent Development

## Overview

The multi-agent system uses **git worktrees** to allow multiple agents to work in parallel without interfering with each other. Each agent gets its own isolated working directory while sharing the same git repository.

## How Worktrees Work

### Directory Structure

```
gamalan/
├── ai-agile/           # Main repository (primary worktree)
│   ├── .git/           # Shared git database
│   ├── services/
│   └── ...
└── agents/             # Agent worktrees (outside main repo)
    ├── dev-1/          # Dev agent 1 worktree
    ├── dev-2/          # Dev agent 2 worktree
    ├── qa-1/           # QA agent worktree
    ├── po-1/           # PO agent worktree
    ├── devops-1/       # DevOps agent worktree
    └── documenter-1/   # Documenter agent worktree
```

### Key Concepts

1. **Worktrees are separate directories** - Each worktree is a complete copy of the repository's files
2. **Shared git database** - All worktrees share the same `.git` directory (saves disk space)
3. **Isolated working state** - Each worktree can be on a different branch independently
4. **Workspace branches** - Each worktree has a "workspace" branch (e.g., `dev-1-workspace`)
5. **Task branches** - Agents create task branches from `origin/main`, not from workspace branches

## Viewing Worktrees

### From Main Repository

```bash
# In ai-agile/ directory
git worktree list
```

Output:
```
/Users/you/gamalan/ai-agile         a155c16 [main]
/Users/you/gamalan/agents/dev-1     a155c16 [dev-1-workspace]
/Users/you/gamalan/agents/qa-1      a155c16 [qa-1-workspace]
...
```

### In Lazygit

**Important:** Lazygit only shows the worktree you're currently in!

- If you open lazygit in `ai-agile/`, you'll only see the main repository
- To see what an agent is doing, open lazygit in their worktree: `cd ../agents/dev-1 && lazygit`

### Checking Agent Activity

```bash
# Check what branches agents are working on
git branch -a | grep task/

# Check recent commits across all worktrees
git log --all --oneline -20

# See what files an agent modified
cd ../agents/dev-1
git status
git diff
```

## How Agents Use Worktrees

### 1. Startup

When `multi-agent-sprint.sh` runs:
1. Creates worktrees at `../agents/`
2. Each worktree starts on its workspace branch (e.g., `dev-1-workspace`)
3. Agents cd into their worktree before executing tasks

### 2. Task Execution

When an agent picks up a task:
1. **Fetch latest**: `git fetch origin main`
2. **Create task branch from origin/main**: `git checkout -b task/abc-123-feature origin/main`
   - This keeps workspace branches clean
   - All task branches start from the same point (latest main)
3. **Make changes**: Agent edits files in its worktree
4. **Commit**: Changes committed to task branch
5. **Push**: Task branch pushed to remote
6. **Create PR**: PR created against `main`
7. **Return to workspace**: Agent checks out workspace branch again

### 3. Branch Isolation

Each agent works on different task branches:
- `dev-1` → `task/abc-111-backend-api`
- `dev-2` → `task/abc-222-frontend-ui`
- `qa-1` → `task/abc-333-test-suite`

**These branches are completely independent!** Agents never conflict because:
- They're on different branches
- They're in different working directories
- Task branches are created from `origin/main`, not from each other

## Common Issues & Solutions

### Issue: "I don't see worktrees in lazygit"

**Cause:** Lazygit only shows the current worktree.

**Solution:**
```bash
# Option 1: Check worktrees from command line
git worktree list

# Option 2: Open lazygit in agent worktree
cd ../agents/dev-1
lazygit
```

### Issue: "Agents are swapping branches under each other"

**Cause:** This was a bug where agents created task branches from workspace branches, causing pollution.

**Solution:** Fixed! Agents now create task branches directly from `origin/main`. Update to latest executor script.

### Issue: "Wrong workspace branch detected after cleanup"

**Cause:** Multiple workspace branches exist (from previous agents or failed cleanups), and the executor picks the wrong one.

**Solution:** Fixed! The executor now:
1. Extracts the agent name from the worktree's git directory path (e.g., `../agents/dev-1/.git` → `dev-1`)
2. Constructs the expected workspace branch name (`dev-1-workspace`)
3. Verifies the branch exists before checking it out
4. Falls back to current branch if it's a workspace branch

This ensures each worktree returns to its **own** workspace branch, not a random one.

### Issue: "Workspace branches have commits"

**Cause:** Old executor logic merged main into workspace branches.

**Solution:**
```bash
# Reset workspace branches to main
cd ../agents/dev-1
git reset --hard origin/main

# Or recreate worktrees
./scripts/cleanup-agent-worktrees.sh --force
./scripts/setup-agent-worktrees.sh 5
```

### Issue: "Can't delete branch in use"

**Cause:** Git prevents deleting a branch that's checked out in any worktree.

**Solution:**
```bash
# Find which worktree is using the branch
git worktree list

# Check out a different branch in that worktree first
cd ../agents/dev-1
git checkout dev-1-workspace

# Now you can delete the branch
git branch -D task/abc-123
```

## Best Practices

1. **Keep workspace branches clean** - They should always point to the same commit as main
2. **One task per branch** - Each agent creates a new branch for each task
3. **Don't manually work in worktrees** - They're managed by the agent system
4. **Clean up regularly** - Use cleanup script when agents finish sprints
5. **Monitor with git worktree list** - This shows you what all agents are doing

## Cleanup

### Remove All Worktrees

```bash
./scripts/cleanup-agent-worktrees.sh
```

This will:
- Remove all agent worktrees
- Delete workspace branches
- Preserve task branches (they might have open PRs)
- Prune stale worktree metadata

### Reset and Recreate

```bash
# Clean up
./scripts/cleanup-agent-worktrees.sh --force

# Recreate (5 agents)
./scripts/setup-agent-worktrees.sh 5

# Verify
git worktree list
```

## Debugging

### Check if you're in a worktree

```bash
git rev-parse --git-dir
# Main repo: .git
# Worktree: ../.git/worktrees/dev-1
```

### List all branches across worktrees

```bash
git branch -a
```

### See what each agent last worked on

```bash
for wt in ../agents/*/; do
  echo "=== $(basename $wt) ==="
  cd $wt
  git log -1 --oneline 2>/dev/null || echo "No commits"
  cd -
done
```

### Find which worktree has uncommitted changes

```bash
for wt in ../agents/*/; do
  cd $wt
  if [[ -n $(git status --porcelain) ]]; then
    echo "$(basename $wt) has uncommitted changes"
  fi
  cd -
done
```

## References

- [Git Worktree Documentation](https://git-scm.com/docs/git-worktree)
- `scripts/setup-agent-worktrees.sh` - Worktree creation script
- `scripts/cleanup-agent-worktrees.sh` - Worktree cleanup script
- `scripts/multi-agent-sprint.sh` - Multi-agent orchestration
