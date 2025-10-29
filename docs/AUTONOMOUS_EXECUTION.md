# Autonomous Sprint Execution Guide

This guide explains how to use Battra's recommendation system to enable autonomous AI agent execution of sprint tasks.

## Overview

Battra now provides a **task recommendation API** that agents can use to discover what tasks to work on next. This enables autonomous sprint execution without requiring a separate orchestrator service.

## Key Insight

You don't need a separate orchestrator service because:
- **Battra already manages task state** (available → owned → in_progress → completed)
- **Battra already has "what next?" logic** via the recommendation API
- **Agents just need to query the API** and act on recommendations

## New API Endpoint

### GET /api/v1/tasks/recommended

Returns task recommendations ranked by score with explanatory reasons.

**Query Parameters:**
- `sprint_id` (UUID, optional) - Filter tasks by sprint
- `project_id` (UUID, optional) - Filter tasks by project
- `story_ids` (comma-separated UUIDs, optional) - Filter tasks by specific stories
- `role` (string, optional) - Filter by task type: `dev`, `qa`, `po`
- `exclude_mine` (boolean, optional) - Exclude tasks I already own
- `limit` (number, optional) - Maximum number of recommendations

**Example Requests:**

```bash
# Get dev tasks for active sprint
curl "http://localhost:8000/api/v1/tasks/recommended?sprint_id={sprint_id}&role=dev&limit=5" \
  -H "X-API-Key: battra-dev-key-1"

# Get QA tasks for a project
curl "http://localhost:8000/api/v1/tasks/recommended?project_id={project_id}&role=qa" \
  -H "X-API-Key: battra-qa-key-1"

# Get all available tasks excluding mine
curl "http://localhost:8000/api/v1/tasks/recommended?sprint_id={sprint_id}&exclude_mine=true" \
  -H "X-API-Key: battra-dev-key-1"
```

**Response Format:**

```json
[
  {
    "task": {
      "id": "uuid",
      "story_id": "uuid",
      "title": "Implement feature X",
      "description": "Details...",
      "status": "available",
      "owner_user_id": null,
      "estimated_hours": 4,
      "acceptance_criteria_refs": ["AC1", "AC2"],
      "created_at": "2025-10-20T10:00:00Z",
      "updated_at": "2025-10-20T10:00:00Z"
    },
    "score": 95.5,
    "reason": "Small task (quick win), Waiting 3 days, 2 AC refs"
  }
]
```

## Recommendation Scoring

Tasks are scored and ranked based on:

1. **Task size** (estimated_hours) - Smaller tasks score higher (quick wins)
2. **Task age** (created_at) - Older tasks score higher (reduce backlog)
3. **Role matching** - Filters by task type based on title/description keywords

### Role Filtering Logic

- **dev/developer**: Matches tasks with "implement", "create", "build", "add" (excludes "test")
- **qa/tester**: Matches tasks with "test", "verify", "e2e"
- **po/product**: Matches tasks with "review", "accept", "validate"

## Autonomous Execution Workflow

### Simple Agent Loop (Bash Script)

```bash
#!/bin/bash
# autonomous-sprint-agent.sh

API_BASE="http://localhost:8000/api/v1"
API_KEY="battra-dev-key-1"
SPRINT_ID="your-sprint-uuid"
ROLE="dev"  # or "qa", "po"

while true; do
  echo "=== Checking for recommended tasks ==="

  # Get recommendations
  TASKS=$(curl -s "$API_BASE/tasks/recommended?sprint_id=$SPRINT_ID&role=$ROLE&limit=1" \
    -H "X-API-Key: $API_KEY")

  TASK_ID=$(echo "$TASKS" | jq -r '.[0].task.id // empty')

  if [ -z "$TASK_ID" ]; then
    echo "No tasks available. Waiting..."
    sleep 60
    continue
  fi

  TASK_TITLE=$(echo "$TASKS" | jq -r '.[0].task.title')
  echo "Found task: $TASK_TITLE"

  # Take ownership
  echo "Taking ownership..."
  curl -s -X PUT "$API_BASE/tasks/$TASK_ID/ownership" \
    -H "X-API-Key: $API_KEY"

  # Execute task (placeholder - integrate with Claude Code here)
  echo "Executing task..."
  # TODO: Call Claude Code to implement the task
  sleep 10  # Simulate work

  # Mark complete
  echo "Marking complete..."
  curl -s -X POST "$API_BASE/tasks/$TASK_ID/work/complete" \
    -H "X-API-Key: $API_KEY"

  echo "Task completed: $TASK_TITLE"
  echo ""
done
```

### Advanced: Multi-Agent Coordination

For running multiple agents (dev + qa + po) in parallel:

```bash
#!/bin/bash
# multi-agent-sprint.sh

SPRINT_ID="your-sprint-uuid"

# Start dev agent in background
./autonomous-sprint-agent.sh "battra-dev-key-1" "$SPRINT_ID" "dev" &
DEV_PID=$!

# Start QA agent in background
./autonomous-sprint-agent.sh "battra-qa-key-1" "$SPRINT_ID" "qa" &
QA_PID=$!

# Start PO agent in background
./autonomous-sprint-agent.sh "battra-po-key-1" "$SPRINT_ID" "po" &
PO_PID=$!

echo "Agents running:"
echo "  Dev agent: PID $DEV_PID"
echo "  QA agent: PID $QA_PID"
echo "  PO agent: PID $PO_PID"

# Wait for all agents
wait $DEV_PID $QA_PID $PO_PID
```

## Integration with Claude Code

To integrate the agent loop with Claude Code for actual task execution:

1. **Agent discovers task** via GET `/api/v1/tasks/recommended`
2. **Agent takes ownership** via PUT `/api/v1/tasks/{id}/ownership`
3. **Claude Code implements task**:
   ```bash
   echo "Implement this task: $TASK_TITLE" | claude-code
   ```
4. **Agent marks complete** via POST `/api/v1/tasks/{id}/work/complete`

## MCP Tools (Future Enhancement)

When the `@battra/mcp-server` package is created, add these tools:

```typescript
// tools/get_recommended_tasks.ts
export const getRecommendedTasks = {
  name: "get_recommended_tasks",
  description: "Get task recommendations for autonomous execution",
  parameters: {
    sprint_id: { type: "string", optional: true },
    project_id: { type: "string", optional: true },
    role: { type: "string", optional: true },
    limit: { type: "number", optional: true }
  },
  async handler(params) {
    const query = new URLSearchParams();
    if (params.sprint_id) query.set('sprint_id', params.sprint_id);
    if (params.project_id) query.set('project_id', params.project_id);
    if (params.role) query.set('role', params.role);
    if (params.limit) query.set('limit', params.limit.toString());

    const response = await fetch(
      `${process.env.BATTRA_API_BASE}/tasks/recommended?${query}`,
      { headers: { 'X-API-Key': process.env.BATTRA_API_KEY } }
    );

    return await response.json();
  }
};
```

## Testing the Recommendation System

### Manual Test via curl

```bash
# 1. Get active sprint ID
SPRINT_ID=$(curl -s "http://localhost:8000/api/v1/projects/{project_id}/sprints/active" \
  -H "X-API-Key: battra-sm-key-1" | jq -r '.id')

# 2. Get dev task recommendations
curl -s "http://localhost:8000/api/v1/tasks/recommended?sprint_id=$SPRINT_ID&role=dev&limit=3" \
  -H "X-API-Key: battra-dev-key-1" | jq

# 3. Take ownership of top task
TASK_ID=$(curl -s "http://localhost:8000/api/v1/tasks/recommended?sprint_id=$SPRINT_ID&role=dev&limit=1" \
  -H "X-API-Key: battra-dev-key-1" | jq -r '.[0].task.id')

curl -X PUT "http://localhost:8000/api/v1/tasks/$TASK_ID/ownership" \
  -H "X-API-Key: battra-dev-key-1"

# 4. Verify task is now owned
curl -s "http://localhost:8000/api/v1/tasks/owned" \
  -H "X-API-Key: battra-dev-key-1" | jq
```

### Verify Scoring Logic

```bash
# Tasks should be ranked with:
# - Smaller estimated_hours first
# - Older tasks first
# - Role-appropriate tasks only

curl -s "http://localhost:8000/api/v1/tasks/recommended?sprint_id=$SPRINT_ID&role=dev" \
  -H "X-API-Key: battra-dev-key-1" | \
  jq '.[] | {title: .task.title, score: .score, reason: .reason}'
```

## What You DON'T Need

Based on the earlier discussion, you **do not need**:

- ❌ Separate orchestrator service (Battra already manages state)
- ❌ Separate workflow engine (task state machine already exists)
- ❌ Separate event bus (can use WebSocket if real-time updates needed)
- ❌ Complex agent registry (role filtering is simple string matching)

## What You DO Need

✅ **Recommendation API** (now implemented)
✅ **Agent execution loop** (simple bash script above)
✅ **Claude Code integration** (call from agent loop)
✅ **MCP tools** (optional, for convenience)

## Sprint-Level Filtering

The recommendation API supports sprint-level filtering via `sprint_id` parameter. This automatically:

1. Finds all stories in the sprint (`stories.sprint_id = $sprint_id`)
2. Gets all tasks for those stories
3. Filters by availability (`status = 'available'`)
4. Applies role filtering (if specified)
5. Scores and ranks tasks

## Project-Level Filtering

Use `project_id` parameter to get recommendations across all stories in a project:

```bash
curl "http://localhost:8000/api/v1/tasks/recommended?project_id={project_id}&role=dev" \
  -H "X-API-Key: battra-dev-key-1"
```

## Next Steps

1. **Test the recommendation API** with your active sprint
2. **Run the autonomous agent script** with your API keys
3. **Integrate Claude Code** for actual task implementation
4. **Create MCP server package** (optional, for richer tool support)
5. **Add monitoring/logging** to track agent progress

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  Agent Loop (Bash/Node/Python)                      │
│                                                     │
│  1. GET /tasks/recommended?sprint_id=X&role=dev     │
│  2. PUT /tasks/{id}/ownership                       │
│  3. [Claude Code implements task]                   │
│  4. POST /tasks/{id}/work/complete                  │
│                                                     │
└──────────────────┬──────────────────────────────────┘
                   │
                   │ HTTP API
                   │
┌──────────────────▼──────────────────────────────────┐
│                                                     │
│  Battra Backend (Rust)                              │
│                                                     │
│  - Task recommendation scoring                      │
│  - Task state management (available→owned→done)     │
│  - Sprint/project/story relationships               │
│  - Role-based filtering                             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Summary

The autonomous execution system is **much simpler** than initially proposed because:

1. Battra **already manages task state** - no orchestrator needed
2. Battra **already has recommendation logic** - just extended it
3. Agents **just query and act** - no complex coordination needed
4. The "orchestrator" is just a **simple loop calling APIs**

This is the **minimum viable approach** for autonomous sprint execution!
