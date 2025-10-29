# Quick Start: Autonomous Agents with Git Workflow

Run autonomous agents with proper git hygiene - branch per task, PR into main, review gates.

## What You Get

✅ **Branch per task** - Isolated changes
✅ **Pull requests** - Review before merge
✅ **CI/CD checks** - Automated testing
✅ **Audit trail** - Clear history
✅ **Rollback** - Easy to revert
✅ **Human oversight** - Optional approval gates

## Prerequisites

1. **GitHub CLI** installed: `gh auth status`
2. **Git configured** with permissions to push
3. **CI/CD setup** (GitHub Actions) for automated tests
4. **Battra API** running

## Setup (5 minutes)

### Step 1: Install GitHub CLI

```bash
# Mac
brew install gh

# Or download from https://cli.github.com/

# Authenticate
gh auth login
```

### Step 2: Set Environment Variables

```bash
# Enable git workflow
export GIT_WORKFLOW_ENABLED=true

# API keys
export BATTRA_API_KEY="battra-dev-key-1"
export ANTHROPIC_API_KEY="sk-ant-..."

# Git settings
export GIT_PR_BASE_BRANCH="main"          # Base branch for PRs
export GIT_AUTO_MERGE=false                # Require manual merge
export GIT_PR_REVIEWERS="team-leads"      # Auto-assign reviewers
```

### Step 3: Test the Workflow

```bash
# Get active sprint
SPRINT_ID=$(curl -s "http://localhost:8000/api/v1/projects/{project_id}/sprints/active" \
  -H "X-API-Key: battra-sm-key-1" | jq -r '.id')

# Run agent with git workflow
./scripts/autonomous-agent.sh battra-dev-key-1 $SPRINT_ID dev
```

## What Happens

```
1. Agent polls for recommended task
   └─> GET /api/v1/tasks/recommended?sprint_id=X&role=dev

2. Agent takes ownership
   └─> PUT /api/v1/tasks/{id}/ownership

3. Agent creates branch
   └─> git checkout -b task/{task-id}-{slug}

4. Agent implements task
   └─> Claude Code makes changes

5. Agent runs tests
   └─> cargo test (must pass)

6. Agent commits changes
   └─> git commit -m "feat: ..."

7. Agent pushes branch
   └─> git push origin task/{task-id}-{slug}

8. Agent creates PR
   └─> gh pr create --title "[Task] ..." --base main

9. Agent waits for CI/reviews
   └─> Polls PR status every 60 seconds

10. PR merged (manual or auto)
    └─> Agent marks task complete
```

## Branch Naming

Format: `task/{task-id}-{slug}`

Examples:
```
task/a1b2c3d4-implement-sprint-task-board
task/e5f6g7h8-add-task-ownership-api
task/i9j0k1l2-write-e2e-tests
```

## Commit Message Format

```
<type>(<scope>): <subject>

<body>

🤖 Generated with Claude Code
Task-ID: {task-id}
Story-ID: {story-id}

Co-Authored-By: Claude <noreply@anthropic.com>
```

Example:
```
feat(backlog): add sprint task board endpoint

Implements GET /api/v1/sprints/{sprint_id}/tasks endpoint
with filtering and grouping support.

Acceptance Criteria:
- AC1: Returns all tasks in sprint
- AC2: Supports status filtering
- AC3: Supports grouping by story/status

🤖 Generated with Claude Code
Task-ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
Story-ID: s1t2o3r4-y5i6-7890-abcd-ef1234567890

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Pull Request Format

**Title:** `[Task] {task-title}`

**Body:**
```markdown
## Task Details
**Task ID:** {task-id}
**Story:** {story-title}
**Implemented by:** Dev Agent

## Acceptance Criteria
- [x] AC1: ...
- [x] AC2: ...

## Testing
- [x] Unit tests pass
- [x] Integration tests pass
- [x] Code quality checks pass
```

## Review Gates

### Automated (CI)
- ✅ Tests pass
- ✅ Code format (cargo fmt)
- ✅ Linting (cargo clippy)
- ✅ Coverage threshold

### Human Review (Optional)
- 👤 Code quality
- 👤 Architecture compliance
- 👤 Security review

## Configuration Options

### Auto-Merge (Risky)

```bash
# Allow agent to merge after CI + review approval
export GIT_AUTO_MERGE=true
```

⚠️ **Warning:** Only enable if you have strong CI/CD and test coverage!

### Manual Merge (Recommended)

```bash
# Require human to merge PRs
export GIT_AUTO_MERGE=false
```

Agent creates PR, waits for approval, **human merges via GitHub UI**.

### Auto-Assign Reviewers

```bash
# Auto-assign team members to review
export GIT_PR_REVIEWERS="alice,bob,charlie"
```

### Custom Base Branch

```bash
# Target different base branch
export GIT_PR_BASE_BRANCH="develop"
```

## Monitoring PRs

### View Open PRs

```bash
gh pr list --author "@me"
```

### Check PR Status

```bash
gh pr view 123
```

### View CI Checks

```bash
gh pr checks 123
```

### Approve PR

```bash
gh pr review 123 --approve
```

### Merge PR

```bash
gh pr merge 123 --squash --delete-branch
```

## Agent Behavior

### When CI Fails

Agent **stops** and logs error. You must:
1. Review the PR
2. Fix the issues manually
3. Push to the same branch
4. Agent will detect the fixes

### When Review Requests Changes

Agent **stops** and logs feedback. You must:
1. Address the comments
2. Push fixes to the same branch
3. Agent will detect the changes

### When Merge Conflicts

Agent **stops**. You must:
1. Checkout the branch
2. Resolve conflicts manually
3. Push resolution
4. Agent will detect the merge

## Multi-Agent with Git Workflow

```bash
# Start all agents with git workflow
export GIT_WORKFLOW_ENABLED=true
export GIT_AUTO_MERGE=false

./scripts/multi-agent-sprint.sh $SPRINT_ID
```

Each agent:
- Creates its own branches
- Creates its own PRs
- Waits for reviews independently

No conflicts because each task = separate branch!

## Safety Features

### 1. No Direct Commits to Main

```bash
# This is blocked by branch protection
git push origin main  # ❌ Forbidden
```

All changes go through PR.

### 2. Required CI Checks

```yaml
# .github/workflows/ci.yml
name: CI
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: cargo test --all
```

PRs cannot merge until CI passes.

### 3. Required Reviews

```yaml
# .github/branch_protection.yml
main:
  required_reviews: 1
  dismiss_stale_reviews: true
  require_code_owner_reviews: true
```

PRs cannot merge without approval.

### 4. Audit Trail

```bash
# See all agent commits
git log --author="Claude" --oneline

# See all agent PRs
gh pr list --author "@me" --state all
```

Clear history of what agents did.

## Rollback Procedure

If agent breaks something:

```bash
# Option 1: Revert the PR merge
git revert <commit-hash>
git push origin main

# Option 2: Revert via GitHub UI
# Go to PR → Revert button → Create revert PR

# Option 3: Cherry-pick good commits
git cherry-pick <good-commit>
```

## Troubleshooting

### "gh: command not found"

```bash
# Install GitHub CLI
brew install gh  # Mac
# or download from https://cli.github.com/

# Authenticate
gh auth login
```

### "Permission denied (push)"

```bash
# Check git auth
git remote -v
git config user.name
git config user.email

# Use SSH or HTTPS with token
gh auth setup-git
```

### "PR creation failed"

```bash
# Check repo permissions
gh repo view

# Ensure you can create PRs
gh pr list
```

### "CI checks timeout"

Agent waits up to 60 minutes. If CI takes longer:
```bash
# Increase timeout in claude-code-executor-with-git.js
const maxAttempts = 120; // 2 hours
```

## Metrics to Track

```typescript
interface GitWorkflowMetrics {
  prsCreated: number;
  prsApprovedFirstTime: number;  // No changes requested
  avgReviewTime: number;          // hours
  ciFailureRate: number;          // %
  mergeConflictRate: number;      // %
}
```

**Goal:** >80% PRs approved first time, <5% CI failures

## Next Steps

1. **Configure branch protection** on GitHub
2. **Set up CI/CD** (GitHub Actions)
3. **Define review policy** (manual vs auto-merge)
4. **Test with small task** first
5. **Monitor PR quality** and adjust

## Example: Complete Flow

```bash
# 1. Enable git workflow
export GIT_WORKFLOW_ENABLED=true
export GIT_AUTO_MERGE=false
export GIT_PR_REVIEWERS="team-leads"

# 2. Get sprint ID
SPRINT_ID="your-sprint-uuid"

# 3. Run agent
./scripts/autonomous-agent.sh battra-dev-key-1 $SPRINT_ID dev

# Agent output:
# 🌿 Creating branch: task/abc-implement-feature
# 🤖 Implementing task...
# 🧪 Tests passed
# 💾 Committed changes
# 📤 Pushed branch
# 🔀 Created PR: https://github.com/org/repo/pull/123
# ⏳ Waiting for CI and reviews...
# ✅ CI passed
# ⏸️  Waiting for manual merge...

# 4. Review the PR on GitHub
gh pr view 123

# 5. Approve and merge
gh pr review 123 --approve
gh pr merge 123 --squash

# Agent detects merge and marks task complete!
```

## Summary

The git workflow provides:

- ✅ **Safety** - No direct commits to main
- ✅ **Review** - Human oversight before merge
- ✅ **CI/CD** - Automated testing
- ✅ **Audit** - Clear history
- ✅ **Rollback** - Easy to revert

This makes autonomous agents **production-ready**! 🎉
