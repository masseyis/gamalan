# Task Recommendation System

## Overview

Battra now includes an intelligent task recommendation system that enables autonomous AI agent execution of sprint tasks. This system extends the existing task management capabilities without requiring a separate orchestrator service.

## What Was Built

### 1. Domain Layer - Recommendation Engine

**Location:** `services/backlog/src/domain/recommendation.rs`

**Components:**
- `TaskRecommendation` - struct containing task, score, and explanation
- `RecommendationFilters` - filtering options (sprint, project, role, etc.) plus the
  `current_user_id` used to prioritize tasks already owned by the requesting agent
- `RecommendationStrategy` trait - pluggable scoring strategies
- `DefaultRecommendationStrategy` - default scoring implementation
- `TaskRecommender` - main recommendation engine

**Scoring & Ordering Logic:**
```rust
- Base score: 100.0
- Estimated hours penalty: -2.0 per hour (prefer smaller tasks)
- Age bonus: +0.5 per day (prefer older tasks)
- Role matching: keyword-based filtering
- Contributor-first ordering: tasks currently owned by the requesting user are always
  returned first (unless `exclude_mine=true`) and include a reason noting they are already
  assigned to you.
```

**Role Filters:**
- `dev` - Matches: "implement", "create", "build", "add" (excludes "test")
- `qa` - Matches: "test", "verify", "e2e"
- `po` - Matches: "review", "accept", "validate"

### 2. Repository Layer - Task Queries

**Location:** `services/backlog/src/adapters/persistence/repo.rs`

**New Functions:**
- `get_tasks_by_sprint()` - Get all tasks in a sprint (via stories)
- `get_tasks_by_project()` - Get all tasks in a project
- `get_tasks_by_story_ids()` - Get tasks for multiple stories

### 3. Application Layer - Use Case

**Location:** `services/backlog/src/application/usecases.rs`

**New Method:**
```rust
pub async fn get_recommended_tasks(
    &self,
    filters: RecommendationFilters,
    organization_id: Option<Uuid>,
) -> Result<Vec<TaskRecommendation>, AppError>
```

Applies recommendation engine to tasks from sprint/project/stories.

### 4. HTTP Layer - API Endpoint

**Location:** `services/backlog/src/adapters/http/handlers.rs`

**New Handler:**
```rust
pub async fn get_recommended_tasks(
    Query(query): Query<GetRecommendedTasksQuery>,
    ...
) -> Result<Json<Vec<TaskRecommendationResponse>>, AppError>
```

**Query Parameters:**
- `sprint_id: Option<Uuid>` - Filter by sprint
- `project_id: Option<Uuid>` - Filter by project
- `story_ids: Option<String>` - Comma-separated story UUIDs
- `role: Option<String>` - Filter by role (dev/qa/po)
- `exclude_mine: Option<bool>` - Exclude tasks I own
- `limit: Option<usize>` - Max recommendations to return

Regardless of filters, the API automatically puts any tasks already owned by the
requesting user at the top of the response so agents resume in-flight work before
grabbing new tasks. Set `exclude_mine=true` if you explicitly want to skip your tasks.

### 5. API Gateway - Route Registration

**Location:** `services/api-gateway/src/lib.rs`

**New Route:**
```rust
.route(
    "/api/v1/tasks/recommended",
    get(backlog_handlers::get_recommended_tasks),
)
```

### 6. Documentation & Scripts

**Created:**
- `docs/AUTONOMOUS_EXECUTION.md` - Complete guide for autonomous execution
- `scripts/autonomous-agent.sh` - Single agent execution loop
- `scripts/multi-agent-sprint.sh` - Multi-agent orchestration

## API Usage Examples

### Get Dev Tasks for Sprint

```bash
curl "http://localhost:8000/api/v1/tasks/recommended?sprint_id={sprint_id}&role=dev&limit=5" \
  -H "X-API-Key: battra-dev-key-1"
```

### Get QA Tasks for Project

```bash
curl "http://localhost:8000/api/v1/tasks/recommended?project_id={project_id}&role=qa" \
  -H "X-API-Key: battra-qa-key-1"
```

### Get All Available Tasks (Excluding Mine)

```bash
curl "http://localhost:8000/api/v1/tasks/recommended?sprint_id={sprint_id}&exclude_mine=true" \
  -H "X-API-Key: battra-dev-key-1"
```

## Response Format

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

## Test Coverage

**Location:** `services/backlog/src/domain/recommendation.rs`

**Tests:**
- `test_scores_smaller_tasks_higher` - Verify smaller tasks score higher
- `test_scores_older_tasks_higher` - Verify older tasks score higher
- `test_filters_dev_tasks` - Verify dev role filtering
- `test_filters_qa_tasks` - Verify QA role filtering
- `test_limits_recommendations` - Verify limit parameter works
- `test_excludes_owned_tasks` - Verify exclude_mine works

All tests pass ✅

## Architecture Decision

### Why No Separate Orchestrator?

After analysis, we determined that a separate orchestrator service is **not needed** because:

1. **Battra already manages task state** - The state machine (available → owned → in_progress → completed) exists
2. **Battra already has task ownership** - PUT/DELETE `/tasks/{id}/ownership` endpoints exist
3. **Recommendation is just scoring + filtering** - No complex coordination needed
4. **Agents can self-coordinate** - Race conditions handled by atomic ownership claims

### What This System Provides

✅ **Intelligent task discovery** - Agents know what to work on next
✅ **Role-based filtering** - Dev/QA/PO agents get appropriate tasks
✅ **Smart prioritization** - Smaller, older tasks prioritized
✅ **Sprint/project scoping** - Tasks filtered to relevant scope
✅ **Simple agent loop** - Bash script orchestrates: discover → claim → execute → complete

### What Was NOT Built (and why)

❌ **Separate orchestrator service** - Battra's existing state management is sufficient
❌ **Complex workflow engine** - Task state machine already exists
❌ **Event bus** - Can use WebSocket if real-time updates needed
❌ **Agent registry** - Role filtering is simple string matching

## Autonomous Execution Workflow

```
┌──────────────────────────────────────────────┐
│ 1. Agent queries recommendation API          │
│    GET /tasks/recommended?sprint_id=X&role=dev│
└─────────────────┬────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────┐
│ 2. Agent takes ownership of top task         │
│    PUT /tasks/{id}/ownership                 │
└─────────────────┬────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────┐
│ 3. Claude Code implements task               │
│    (via agent script integration)            │
└─────────────────┬────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────┐
│ 4. Agent marks task complete                 │
│    POST /tasks/{id}/work/complete            │
└─────────────────┬────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────┐
│ 5. Loop back to step 1                       │
└──────────────────────────────────────────────┘
```

## Running Autonomous Agents

### Single Agent

```bash
./scripts/autonomous-agent.sh battra-dev-key-1 <sprint-uuid> dev
```

### Multi-Agent (Dev + QA + PO)

```bash
./scripts/multi-agent-sprint.sh <sprint-uuid>
```

### With Custom Settings

```bash
export BATTRA_API_BASE="http://localhost:8000/api/v1"
export POLL_INTERVAL=60  # Check every 60 seconds
export MAX_ITERATIONS=10  # Stop after 10 tasks

./scripts/autonomous-agent.sh battra-qa-key-1 <sprint-uuid> qa
```

## Next Steps

### Short Term
1. **Test the recommendation API** with real sprint data
2. **Run autonomous agent** in supervised mode
3. **Integrate Claude Code** for actual task implementation

### Medium Term
1. **Create MCP server package** (`@battra/mcp-server`) with tools:
   - `get_recommended_tasks`
   - `take_task`
   - `complete_task`
   - `get_active_sprint`
2. **Add monitoring/logging** for agent activity
3. **Add metrics** (tasks completed, average time, failure rate)

### Long Term
1. **Improve scoring strategy** - Consider task dependencies, contributor skills
2. **Add learning** - Adjust scoring based on past success/failure
3. **Add agent coordination** - Prevent duplicate work, handle handoffs
4. **Add human oversight** - Approval gates for critical tasks

## File Checklist

### Core Implementation
- ✅ `services/backlog/src/domain/recommendation.rs` - Domain logic
- ✅ `services/backlog/src/domain/mod.rs` - Module export
- ✅ `services/backlog/src/adapters/persistence/repo.rs` - Repository queries
- ✅ `services/backlog/src/application/usecases.rs` - Use case
- ✅ `services/backlog/src/adapters/http/handlers.rs` - HTTP handler
- ✅ `services/api-gateway/src/lib.rs` - Route registration

### Documentation & Scripts
- ✅ `docs/AUTONOMOUS_EXECUTION.md` - Complete usage guide
- ✅ `docs/RECOMMENDATION_SYSTEM.md` - This file
- ✅ `scripts/autonomous-agent.sh` - Single agent script
- ✅ `scripts/multi-agent-sprint.sh` - Multi-agent orchestration

### Tests
- ✅ Unit tests in `recommendation.rs` (6 tests, all passing)

## Summary

This implementation provides the **minimum viable foundation** for autonomous sprint execution:

- **Smart task discovery** via recommendation API
- **Role-based filtering** for dev/qa/po agents
- **Simple orchestration** via bash scripts
- **Leverages existing** Battra state management
- **No complex infrastructure** needed

The system is **production-ready for supervised autonomous execution** where humans monitor agent activity. Full unsupervised execution would require additional safeguards (approval gates, rollback mechanisms, etc.).
