# Quick Start: Full Autonomous Development

Set up a completely autonomous development team in 10 minutes. The Scrum Master plans sprints, dev agents write code, QA agents write tests, and PRs flow continuously.

## What You Get

✅ **Scrum Master Agent** - Automatically plans and manages sprints
✅ **Dev Agents (N)** - Continuously implement tasks
✅ **QA Agents (M)** - Continuously write tests
✅ **Git Workflow** - Branch per task, PRs, reviews
✅ **CI/CD Integration** - Automated testing
✅ **Hands-Off Operation** - Just monitor progress

## Prerequisites

1. **Battra API** running locally (`http://localhost:8000`)
2. **GitHub CLI** installed and authenticated (`gh auth status`)
3. **Node.js** 18+ installed
4. **API Keys**:
   - Battra API keys (scrum master, dev, qa)
   - Anthropic API key
5. **Git** configured with push permissions
6. **CI/CD** setup (GitHub Actions)

## Architecture

```
┌─────────────────────────────────────────────────────┐
│         Scrum Master Agent (Terminal 1)              │
│  Every 5 min: Check sprint → Plan if needed → Close │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│                 Active Sprint                        │
│  Ready stories → Tasks available for agents         │
└────────────────────┬────────────────────────────────┘
                     │
          ┌──────────┼──────────┐
          ▼          ▼           ▼
    ┌─────────┐ ┌─────────┐ ┌─────────┐
    │  Dev 1  │ │  Dev 2  │ │   QA    │
    │         │ │         │ │         │
    │ Pull    │ │ Pull    │ │ Pull    │
    │ ↓       │ │ ↓       │ │ ↓       │
    │ Code    │ │ Code    │ │ Test    │
    │ ↓       │ │ ↓       │ │ ↓       │
    │ PR      │ │ PR      │ │ PR      │
    │ ↓       │ │ ↓       │ │ ↓       │
    │ Done    │ │ Done    │ │ Done    │
    └─────────┘ └─────────┘ └─────────┘
          │          │           │
          └──────────┴───────────┘
                     │
                     ▼
         Sprint Complete → Scrum Master closes
                     │
                     ▼
         New Sprint Planned → Cycle repeats ♻️
```

## Setup (10 Minutes)

### Step 1: Set Environment Variables

Create `.env.autonomous` file:

```bash
# API Configuration
export BATTRA_API_BASE=http://localhost:8000/api/v1
export BATTRA_PROJECT_ID=<your-project-uuid>

# Scrum Master
export SCRUMMASTER_API_KEY=battra-sm-key-1

# Dev Agents
export DEV_AGENT_1_API_KEY=battra-dev-key-1
export DEV_AGENT_2_API_KEY=battra-dev-key-2

# QA Agent
export QA_AGENT_API_KEY=battra-qa-key-1

# Claude Code
export ANTHROPIC_API_KEY=sk-ant-...

# Git Workflow
export GIT_WORKFLOW_ENABLED=true
export GIT_PR_BASE_BRANCH=main
export GIT_AUTO_MERGE=false
export GIT_PR_REVIEWERS=team-leads

# Sprint Configuration
export SPRINT_CAPACITY=40
export SPRINT_DURATION=14
export SPRINT_SELECTION_STRATEGY=fifo  # or 'ai'
export POLL_INTERVAL=300  # 5 minutes
```

Load environment:
```bash
source .env.autonomous
```

### Step 2: Verify Prerequisites

```bash
# Check GitHub CLI
gh auth status

# Check Node.js
node --version

# Check API connectivity
curl -H "X-API-Key: $SCRUMMASTER_API_KEY" \
  "$BATTRA_API_BASE/projects/$BATTRA_PROJECT_ID/stories?status=ready"

# Should return ready stories
```

### Step 3: Start Scrum Master

**Terminal 1:**
```bash
source .env.autonomous
./scripts/scrummaster-agent.sh $SCRUMMASTER_API_KEY $BATTRA_PROJECT_ID
```

You'll see:
```
[SCRUMMASTER] Starting Scrum Master agent
[SCRUMMASTER]   API Base: http://localhost:8000/api/v1
[SCRUMMASTER]   Project ID: 35299584-b133-4b20-af2d-446bb1dead6a
[SCRUMMASTER]   Poll Interval: 300s
[SCRUMMASTER]   Sprint Capacity: 40 points
[SCRUMMASTER]   Sprint Duration: 14 days

[SCRUMMASTER] === Iteration 1 ===
[SCRUMMASTER] Checking for active sprint...
[SCRUMMASTER] No active sprint found
[SCRUMMASTER] Initiating sprint planning...
...
[SCRUMMASTER] New sprint created: Sprint 3 - 2025-01-15
```

Get the sprint ID from the output, or query:
```bash
curl -H "X-API-Key: $SCRUMMASTER_API_KEY" \
  "$BATTRA_API_BASE/projects/$BATTRA_PROJECT_ID/sprints/active" | jq -r '.id'
```

### Step 4: Start Dev Agents

**Terminal 2 (Dev Agent 1):**
```bash
source .env.autonomous
export BATTRA_API_KEY=$DEV_AGENT_1_API_KEY
export BATTRA_SPRINT_ID=<sprint-uuid-from-step-3>

./scripts/autonomous-agent.sh $DEV_AGENT_1_API_KEY $BATTRA_SPRINT_ID dev
```

**Terminal 3 (Dev Agent 2):**
```bash
source .env.autonomous
export BATTRA_API_KEY=$DEV_AGENT_2_API_KEY
export BATTRA_SPRINT_ID=<sprint-uuid-from-step-3>

./scripts/autonomous-agent.sh $DEV_AGENT_2_API_KEY $BATTRA_SPRINT_ID dev
```

### Step 5: Start QA Agent

**Terminal 4 (QA Agent):**
```bash
source .env.autonomous
export BATTRA_API_KEY=$QA_AGENT_API_KEY
export BATTRA_SPRINT_ID=<sprint-uuid-from-step-3>

./scripts/autonomous-agent.sh $QA_AGENT_API_KEY $BATTRA_SPRINT_ID qa
```

## What Happens Next

### Minute 0: Sprint Planning

```
[SCRUMMASTER] Initiating sprint planning...
📥 Fetching ready stories...
✅ Found 8 ready stories
📊 Selecting stories (FIFO strategy, capacity: 40 points)...
  ✓ Selected: [8pts] User authentication
  ✓ Selected: [5pts] Password reset
  ✓ Selected: [13pts] OAuth integration
  ✓ Selected: [8pts] Login rate limiting
  ✓ Selected: [5pts] Session management
✅ Selected 5 stories (39 points)
📝 Creating sprint: Sprint 3 - 2025-01-15
✅ Sprint created successfully
```

### Minute 1: Dev Agents Start Working

**Dev Agent 1:**
```
[INFO] === Iteration 1 ===
[INFO] Fetching recommended tasks...
[SUCCESS] Found task: Implement user authentication endpoint
[INFO]   Score: 0.95
[INFO]   Reason: High priority, matches dev role
[INFO] Taking ownership of task...
[SUCCESS] Ownership acquired

🌿 Creating branch: task/abc123-implement-user-auth
🤖 Invoking Claude Code...
[Claude implements authentication endpoint]
🧪 Running tests...
✅ All tests passed
💾 Committing changes...
📤 Pushing branch...
🔀 Creating PR: https://github.com/org/repo/pull/42
⏳ Waiting for CI and reviews...
```

**Dev Agent 2:**
```
[INFO] === Iteration 1 ===
[INFO] Fetching recommended tasks...
[SUCCESS] Found task: Implement password reset endpoint
...
```

### Minute 5: PRs Under Review

Both dev agents have PRs open, waiting for CI + reviews:

```bash
gh pr list --author "@me"
# #42 [Task] Implement user authentication endpoint
# #43 [Task] Implement password reset endpoint
```

CI is running tests automatically.

### Minute 10: First PR Merged

**Dev Agent 1:**
```
✅ CI passed
⏸️  Waiting for manual merge...
```

Human reviews and merges PR #42:
```bash
gh pr review 42 --approve
gh pr merge 42 --squash
```

**Dev Agent 1:**
```
✅ PR merged!
[INFO] Marking task as complete...
[SUCCESS] Task completed: Implement user authentication endpoint

[INFO] === Iteration 2 ===
[INFO] Fetching recommended tasks...
[SUCCESS] Found task: Implement session management
...
```

Dev Agent 1 immediately picks up the next task!

### Hour 2: QA Agent Joins

**QA Agent:**
```
[INFO] Fetching recommended tasks...
[SUCCESS] Found task: Write e2e tests for authentication
[INFO] Taking ownership of task...

🌿 Creating branch: task/def456-write-auth-tests
🤖 Invoking Claude Code...
[Claude writes Playwright tests]
🧪 Running tests...
✅ All tests passed
...
🔀 Creating PR: https://github.com/org/repo/pull/44
```

### Day 7: Sprint Progress

**Scrum Master:**
```
[SCRUMMASTER] === Iteration 140 ===
[SCRUMMASTER] Active sprint found: Sprint 3 - 2025-01-15
[SPRINT] ════════════════════════════════════════
[SPRINT] Sprint Report: Sprint 3 - 2025-01-15
[SPRINT] ════════════════════════════════════════
[SPRINT] Tasks: 18 / 25 completed
[SPRINT] Points: 30 / 39 completed
[SPRINT] Completion: 72%
[SPRINT] ════════════════════════════════════════
[SCRUMMASTER] Sprint in progress. Will check again in 300s
```

### Day 12: Sprint Complete

**Scrum Master:**
```
[SCRUMMASTER] === Iteration 348 ===
[SCRUMMASTER] Active sprint found: Sprint 3 - 2025-01-15
[SPRINT] ════════════════════════════════════════
[SPRINT] Sprint Report: Sprint 3 - 2025-01-15
[SPRINT] ════════════════════════════════════════
[SPRINT] Tasks: 25 / 25 completed
[SPRINT] Points: 39 / 39 completed
[SPRINT] Completion: 100%
[SPRINT] ════════════════════════════════════════
[SCRUMMASTER] Sprint is complete! Closing sprint...
[SCRUMMASTER] Sprint closed successfully
[SCRUMMASTER] Next iteration will plan a new sprint

[SCRUMMASTER] === Iteration 349 ===
[SCRUMMASTER] Checking for active sprint...
[SCRUMMASTER] No active sprint found
[SCRUMMASTER] Initiating sprint planning...
📥 Fetching ready stories...
✅ Found 6 ready stories
...
[SCRUMMASTER] New sprint created: Sprint 4 - 2025-01-27
```

**Dev agents automatically continue working in new sprint!**

## Monitoring

### View All PRs

```bash
gh pr list --author "@me"
```

### Check Sprint Status

```bash
curl -H "X-API-Key: $SCRUMMASTER_API_KEY" \
  "$BATTRA_API_BASE/sprints/<sprint-id>/status" | jq
```

### View Agent Logs

Each agent logs to its terminal. Use `tmux` or `screen` to manage multiple terminals:

```bash
# Install tmux
brew install tmux

# Start tmux session
tmux new-session -s autonomous

# Split into 4 panes
# Ctrl+B then " (split horizontally)
# Ctrl+B then % (split vertically)

# Run each agent in a pane
# Pane 1: scrummaster-agent.sh
# Pane 2: dev agent 1
# Pane 3: dev agent 2
# Pane 4: qa agent

# Detach: Ctrl+B then D
# Re-attach: tmux attach -t autonomous
```

### View GitHub Actions

```bash
gh run list --limit 20
gh run view <run-id>
```

## Scaling

### Add More Dev Agents

```bash
# Terminal N
export BATTRA_API_KEY=battra-dev-key-N
export BATTRA_SPRINT_ID=<sprint-uuid>
./scripts/autonomous-agent.sh $BATTRA_API_KEY $BATTRA_SPRINT_ID dev
```

### Adjust Sprint Capacity

```bash
# For larger teams
export SPRINT_CAPACITY=80  # 2x capacity
```

### Faster Sprints

```bash
# 1-week sprints
export SPRINT_DURATION=7
```

### More Frequent Checks

```bash
# Check every 1 minute
export POLL_INTERVAL=60
```

## Configuration Profiles

### Conservative (Recommended for Start)

```bash
export SPRINT_CAPACITY=30
export SPRINT_DURATION=14
export POLL_INTERVAL=300
export GIT_AUTO_MERGE=false  # Require human approval
```

### Aggressive (High-Trust Team)

```bash
export SPRINT_CAPACITY=60
export SPRINT_DURATION=7
export POLL_INTERVAL=60
export GIT_AUTO_MERGE=true   # Auto-merge approved PRs
```

### AI-Optimized

```bash
export SPRINT_SELECTION_STRATEGY=ai
export ANTHROPIC_API_KEY=sk-ant-...
export SPRINT_CAPACITY=40
```

## Stopping Agents

### Graceful Shutdown

Press `Ctrl+C` in each terminal:

```
[SCRUMMASTER] Agent interrupted. Exiting...
```

Agents will:
- Finish current iteration
- Not abandon in-progress work
- Exit cleanly

### Resume Later

Just restart the agents:
```bash
./scripts/scrummaster-agent.sh $SCRUMMASTER_API_KEY $BATTRA_PROJECT_ID
```

They'll pick up where they left off!

## Troubleshooting

### "No tasks available"

**Problem:** Dev agents can't find tasks.

**Solution:**
1. Check sprint has stories
2. Verify stories have tasks
3. Check task status (not all owned/completed)
4. Review task recommendation logic

### "Sprint planning fails"

**Problem:** Scrum Master can't create sprint.

**Solution:**
1. Check ready stories exist
2. Verify API permissions
3. Review story point estimates
4. Check capacity settings

### "PRs not merging"

**Problem:** PRs sit waiting for approval.

**Solution:**
1. Review PRs manually
2. Check CI status
3. Consider enabling `GIT_AUTO_MERGE=true`
4. Assign reviewers in GitHub

### "Agent crashes"

**Problem:** Agent exits unexpectedly.

**Solution:**
1. Check error logs
2. Verify API connectivity
3. Check environment variables
4. Restart agent

## Production Deployment

### Option 1: Long-Running Servers

Deploy agents to servers that run 24/7:

```bash
# systemd service (Linux)
[Unit]
Description=Battra Scrum Master Agent
After=network.target

[Service]
Type=simple
User=battra
WorkingDirectory=/opt/battra
EnvironmentFile=/opt/battra/.env.autonomous
ExecStart=/opt/battra/scripts/scrummaster-agent.sh
Restart=always

[Install]
WantedBy=multi-user.target
```

### Option 2: Cron Jobs

Run agents periodically:

```bash
# crontab
# Run scrum master every 5 minutes
*/5 * * * * /path/to/scrummaster-agent.sh >> /var/log/scrummaster.log 2>&1

# Run dev agents continuously
* * * * * /path/to/autonomous-agent.sh dev >> /var/log/dev-agent.log 2>&1
```

### Option 3: Docker Compose

```yaml
# docker-compose.yml
version: '3'
services:
  scrummaster:
    image: battra/autonomous-agent
    environment:
      - BATTRA_API_KEY=${SCRUMMASTER_API_KEY}
      - BATTRA_PROJECT_ID=${BATTRA_PROJECT_ID}
    command: ./scripts/scrummaster-agent.sh
    restart: always

  dev-agent-1:
    image: battra/autonomous-agent
    environment:
      - BATTRA_API_KEY=${DEV_AGENT_1_API_KEY}
      - GIT_WORKFLOW_ENABLED=true
    command: ./scripts/autonomous-agent.sh dev
    restart: always

  dev-agent-2:
    image: battra/autonomous-agent
    environment:
      - BATTRA_API_KEY=${DEV_AGENT_2_API_KEY}
      - GIT_WORKFLOW_ENABLED=true
    command: ./scripts/autonomous-agent.sh dev
    restart: always
```

## Metrics Dashboard

Track autonomous team performance:

```typescript
interface TeamMetrics {
  // Sprint metrics
  sprintsCompleted: number;
  avgSprintVelocity: number;
  avgSprintDuration: number;

  // Task metrics
  tasksCompleted: number;
  avgTaskDuration: number;
  taskSuccessRate: number;

  // PR metrics
  prsCreated: number;
  prsMerged: number;
  avgPRReviewTime: number;
  prFirstTimeApprovalRate: number;

  // CI metrics
  ciSuccessRate: number;
  avgCIDuration: number;
}
```

Query from API:
```bash
curl -H "X-API-Key: $SCRUMMASTER_API_KEY" \
  "$BATTRA_API_BASE/projects/$BATTRA_PROJECT_ID/metrics"
```

## Cost Estimation

### Claude API Costs

**Per task (avg):**
- Input: 4,000 tokens × $0.015 = $0.06
- Output: 2,000 tokens × $0.075 = $0.15
- **Total: $0.21 per task**

**Per sprint (40 points, ~25 tasks):**
- 25 tasks × $0.21 = **$5.25 per sprint**

**Per month (2 sprints):**
- 2 sprints × $5.25 = **$10.50 per month**

### Infrastructure Costs

- **Local development**: $0 (runs on your machine)
- **Cloud VMs**: $5-20/month (small instances)
- **GitHub Actions**: Free for public repos, $0.008/minute private

**Total estimated cost: $10-30/month for autonomous team**

Compare to:
- Junior developer: $5,000-8,000/month
- **ROI: ~300x** 🚀

## Best Practices

### 1. Start Small

Begin with:
- 1 Scrum Master
- 1 Dev agent
- Small sprint capacity (20 points)
- Manual PR merges

Gradually scale up.

### 2. Monitor Closely (First Week)

Watch agents to ensure:
- Tasks are reasonable
- Code quality is good
- Tests are comprehensive
- PRs are mergeable

### 3. Review PRs Diligently

Even with CI, human review catches:
- Architectural issues
- Business logic errors
- Security concerns

### 4. Tune Capacity

Adjust `SPRINT_CAPACITY` based on actual velocity:
```bash
# If sprints finish early, increase capacity
export SPRINT_CAPACITY=50

# If sprints don't finish, decrease capacity
export SPRINT_CAPACITY=30
```

### 5. Use AI Selection (When Ready)

After validating FIFO works:
```bash
export SPRINT_SELECTION_STRATEGY=ai
```

Claude will prioritize high-value work.

## Summary

You now have a **fully autonomous development team**:

1. ✅ **Scrum Master** plans sprints automatically
2. ✅ **Dev agents** implement tasks continuously
3. ✅ **QA agents** write tests continuously
4. ✅ **Git workflow** ensures code quality
5. ✅ **CI/CD** validates changes
6. ✅ **PRs** provide review gates

**Just start the agents and watch the PRs flow!** 🎉

For more details, see:
- `SCRUMMASTER_AGENT.md` - Scrum Master documentation
- `GIT_WORKFLOW_FOR_AGENTS.md` - Git workflow details
- `QUICK_START_GIT_WORKFLOW.md` - Git workflow quick start
