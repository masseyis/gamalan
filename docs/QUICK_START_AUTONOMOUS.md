# Quick Start: Autonomous Sprint Execution

Get autonomous AI agents working on your sprint in 5 minutes.

## Prerequisites

1. **Battra API running** on `http://localhost:8000`
2. **Active sprint** with tasks in "available" status
3. **Anthropic API key** for Claude Code
4. **Node.js** installed (for Claude Code executor)

## Step 1: Set Environment Variables

```bash
# Battra API
export BATTRA_API_BASE="http://localhost:8000/api/v1"
export BATTRA_API_KEY="battra-dev-key-1"  # or your dev key

# Anthropic API
export ANTHROPIC_API_KEY="sk-ant-..."  # Your API key
```

## Step 2: Test the Recommendation API

```bash
# Get your active sprint ID
SPRINT_ID=$(curl -s "http://localhost:8000/api/v1/projects/{project_id}/sprints/active" \
  -H "X-API-Key: battra-sm-key-1" | jq -r '.id')

# Get recommended dev tasks
curl "http://localhost:8000/api/v1/tasks/recommended?sprint_id=$SPRINT_ID&role=dev&limit=3" \
  -H "X-API-Key: battra-dev-key-1" | jq
```

Expected output:
```json
[
  {
    "task": {
      "id": "uuid",
      "title": "Implement feature X",
      "status": "available",
      ...
    },
    "score": 95.5,
    "reason": "Small task (quick win), Waiting 3 days, 2 AC refs"
  }
]
```

## Step 3: Test Claude Code Integration

Run the integration test script:

```bash
./scripts/test-claude-integration.sh
```

This will:
1. ✅ Check environment variables
2. ✅ Find active sprint
3. ✅ Get recommended task
4. ✅ Show task details
5. ✅ Ask for confirmation
6. ✅ Take ownership
7. ✅ Execute with Claude Code
8. ✅ Mark complete

## Step 4: Run Single Agent (Manual)

```bash
./scripts/autonomous-agent.sh battra-dev-key-1 $SPRINT_ID dev
```

This agent will:
- Poll for recommended dev tasks every 30 seconds
- Take ownership of top-ranked task
- Execute it with Claude Code
- Mark it complete
- Repeat indefinitely

**Press Ctrl+C to stop**

## Step 5: Run Multi-Agent (Supervised)

```bash
./scripts/multi-agent-sprint.sh $SPRINT_ID
```

This starts 3 agents:
- **Dev agent** (implements features)
- **QA agent** (writes tests)
- **PO agent** (reviews stories)

Monitor logs:
```bash
# In separate terminals
tail -f logs/autonomous-agents/dev-agent.log
tail -f logs/autonomous-agents/qa-agent.log
tail -f logs/autonomous-agents/po-agent.log
```

**Press Ctrl+C to stop all agents**

## Configuration Options

### Custom Poll Interval

```bash
# Check for tasks every 60 seconds instead of 30
export POLL_INTERVAL=60
./scripts/autonomous-agent.sh battra-dev-key-1 $SPRINT_ID dev
```

### Maximum Iterations

```bash
# Stop after completing 5 tasks
export MAX_ITERATIONS=5
./scripts/autonomous-agent.sh battra-dev-key-1 $SPRINT_ID dev
```

### Different Roles

```bash
# QA agent
./scripts/autonomous-agent.sh battra-qa-key-1 $SPRINT_ID qa

# Product Owner agent
./scripts/autonomous-agent.sh battra-po-key-1 $SPRINT_ID po
```

## Troubleshooting

### No tasks available

**Problem:** Agent keeps saying "No tasks available"

**Solution:**
1. Check tasks exist in sprint: `curl http://localhost:8000/api/v1/tasks/recommended?sprint_id=$SPRINT_ID`
2. Check tasks are in "available" status
3. Check role filter matches tasks (e.g., dev tasks have "implement", "create" in title)

### Claude Code API errors

**Problem:** "Claude API error: 401"

**Solution:**
1. Verify ANTHROPIC_API_KEY is set: `echo $ANTHROPIC_API_KEY`
2. Check API key is valid at https://console.anthropic.com
3. Ensure you have API credits available

### Tests fail after implementation

**Problem:** Task execution fails with "Tests failed"

**Solution:**
1. Review the Claude Code output
2. Manually fix the implementation
3. Re-run tests: `cargo test --package backlog`
4. The agent will automatically retry on next iteration

### Ownership race conditions

**Problem:** "Failed to take ownership. Task may have been claimed by another agent."

**Solution:**
- This is expected when multiple agents run
- The losing agent will retry with next task
- No action needed - this is normal behavior

## Monitoring

### Check Agent Progress

```bash
# Get all owned tasks
curl "http://localhost:8000/api/v1/tasks/owned" \
  -H "X-API-Key: battra-dev-key-1" | jq

# Get sprint progress
curl "http://localhost:8000/api/v1/sprints/$SPRINT_ID" \
  -H "X-API-Key: battra-sm-key-1" | jq
```

### View Recent Completions

```bash
# Get completed tasks in last hour
curl "http://localhost:8000/api/v1/tasks?status=completed&since=1h" \
  -H "X-API-Key: battra-dev-key-1" | jq
```

## Next Steps

### 1. Improve Task Descriptions

For best results, ensure tasks have:
- Clear, unambiguous titles
- Detailed descriptions with file paths
- Specific acceptance criteria
- Estimated hours

See: `docs/autonomous-sprint-requirements.md`

### 2. Create MCP Server Package

For richer tool support:
```bash
cd packages
mkdir mcp-server
cd mcp-server
npm init -y
# Add tools: get_recommended_tasks, take_task, complete_task
```

See: `docs/AUTONOMOUS_EXECUTION.md#mcp-tools-future-enhancement`

### 3. Add Monitoring Dashboard

Track agent metrics:
- Tasks completed per hour
- Success rate
- Average execution time
- Failure reasons

### 4. Enable Auto-Commit

Update `autonomous-agent.sh` to automatically commit changes:
```bash
git add .
git commit -m "feat: $TASK_TITLE [task:$TASK_ID]"
```

## Safety Considerations

⚠️ **This is supervised autonomous execution**

- Agents can implement tasks automatically
- Tests must pass before marking complete
- Review agent output before deploying
- Start with small, low-risk tasks
- Monitor agent logs actively

🚫 **Not recommended for production yet:**
- No approval gates for critical changes
- No rollback mechanism
- No human review of code quality
- No security scanning

Use in **development/staging environments** only until you add additional safeguards.

## Architecture

```
┌───────────────────────────────────────┐
│  autonomous-agent.sh                  │
│  - Poll recommendation API            │
│  - Take ownership                     │
│  - Call claude-code-executor.js       │
│  - Mark complete                      │
└──────────────┬────────────────────────┘
               │
               ▼
┌───────────────────────────────────────┐
│  claude-code-executor.js              │
│  - Fetch task + ACs from Battra API   │
│  - Build detailed prompt              │
│  - Call Claude Code API               │
│  - Run tests                          │
│  - Run quality checks                 │
└──────────────┬────────────────────────┘
               │
               ▼
┌───────────────────────────────────────┐
│  Battra Backend                       │
│  - Task recommendation scoring        │
│  - Task state management              │
│  - Sprint/project filtering           │
└───────────────────────────────────────┘
```

## Success Metrics

Track these to measure autonomous execution effectiveness:

- **Tasks completed** per sprint
- **Success rate** (completed / attempted)
- **Average time** per task
- **Test pass rate** on first attempt
- **Manual interventions** required

Goal: **>80% success rate** with **<10% manual interventions**

## Support

Issues? Check:
1. `docs/AUTONOMOUS_EXECUTION.md` - Complete guide
2. `docs/CLAUDE_CODE_INTEGRATION.md` - Integration details
3. `docs/RECOMMENDATION_SYSTEM.md` - Technical reference

Still stuck? File an issue with:
- Agent logs
- Task details
- Error messages
- Environment setup
