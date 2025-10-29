# Scrum Master Agent - Autonomous Sprint Management

The Scrum Master agent automates sprint planning, monitoring, and closure. It ensures there's always an active sprint with work available for dev/qa agents.

## Overview

The Scrum Master agent runs continuously and:

1. **Checks for active sprint** every 5 minutes
2. **Plans new sprint** if none exists:
   - Fetches ready stories from Readiness service
   - Selects stories to fit capacity (default: 40 points)
   - Creates sprint via API
3. **Monitors sprint progress**:
   - Tracks task completion
   - Generates progress reports
4. **Closes sprints** when all tasks complete:
   - Marks sprint as done
   - Generates final report
   - Next iteration plans new sprint

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Scrum Master Agent                      │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              scrummaster-agent.sh                 │   │
│  │  - Check for active sprint                        │   │
│  │  - Plan new sprint if needed                      │   │
│  │  - Monitor sprint progress                        │   │
│  │  - Close sprint when complete                     │   │
│  └──────────────────┬───────────────────────────────┘   │
│                     │                                    │
│                     ▼                                    │
│  ┌──────────────────────────────────────────────────┐   │
│  │             sprint-planner.js                     │   │
│  │  - Fetch ready stories                            │   │
│  │  - Select stories (FIFO or AI)                    │   │
│  │  - Create sprint via API                          │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   Battra API                             │
│  - GET /projects/{id}/sprints/active                    │
│  - GET /projects/{id}/stories?status=ready              │
│  - POST /projects/{id}/sprints                          │
│  - GET /sprints/{id}/status                             │
│  - POST /sprints/{id}/complete                          │
└─────────────────────────────────────────────────────────┘
```

## Sprint Planning Logic

### FIFO Strategy (Default)

Takes stories from the top of the ready backlog until capacity is reached:

```
Ready Stories (ordered):
1. [8pts] User authentication
2. [5pts] Password reset
3. [13pts] OAuth integration
4. [3pts] Login rate limiting

Capacity: 20 points

Selected:
✓ [8pts] User authentication
✓ [5pts] Password reset
✗ [13pts] OAuth integration (would exceed capacity)
✓ [3pts] Login rate limiting (fits with remaining 7pts? No, need 3)

Final: Stories 1, 2, 4 = 16 points
```

### AI Strategy (Optional)

Uses Claude to evaluate stories and select highest-value work:

```bash
export SPRINT_SELECTION_STRATEGY=ai
export ANTHROPIC_API_KEY=sk-ant-...
```

Claude analyzes:
- Story descriptions
- Business value
- Dependencies
- Risk vs reward

And selects stories that provide maximum value within capacity.

## Configuration

### Environment Variables

```bash
# Required
export BATTRA_API_KEY="battra-sm-key-1"        # Scrum Master API key
export BATTRA_PROJECT_ID="project-uuid"         # Project to manage

# Optional
export BATTRA_API_BASE="http://localhost:8000/api/v1"  # API endpoint
export POLL_INTERVAL=300                        # Check every 5 minutes
export SPRINT_CAPACITY=40                       # Story points per sprint
export SPRINT_DURATION=14                       # Sprint length in days
export SPRINT_SELECTION_STRATEGY=fifo           # 'fifo' or 'ai'
export ANTHROPIC_API_KEY=sk-ant-...             # Required for AI strategy
```

## Usage

### Start Scrum Master Agent

```bash
# Using arguments
./scripts/scrummaster-agent.sh battra-sm-key-1 <project-uuid>

# Using env vars
export BATTRA_API_KEY=battra-sm-key-1
export BATTRA_PROJECT_ID=<project-uuid>
./scripts/scrummaster-agent.sh

# With AI-based planning
export SPRINT_SELECTION_STRATEGY=ai
export ANTHROPIC_API_KEY=sk-ant-...
./scripts/scrummaster-agent.sh battra-sm-key-1 <project-uuid>
```

### What You'll See

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
📥 Fetching ready stories...
✅ Found 12 ready stories
📊 Selecting stories (FIFO strategy, capacity: 40 points)...
  ✓ Selected: [8pts] User authentication
  ✓ Selected: [5pts] Password reset
  ✓ Selected: [13pts] OAuth integration
  ✓ Selected: [8pts] Login rate limiting
  ✓ Selected: [5pts] Session management
✅ Selected 5 stories (39 points)
📝 Creating sprint: Sprint 3 - 2025-01-15
  Start: 2025-01-15
  End: 2025-01-29
  Stories: 5
  Points: 39
✅ Sprint created successfully
[SCRUMMASTER] New sprint created: Sprint 3 - 2025-01-15 (ID: abc-def-ghi)
[SPRINT] Stories: 5
[SPRINT] Total Points: 39
[SPRINT] Stories in sprint:
  - [8pts] User authentication
  - [5pts] Password reset
  - [13pts] OAuth integration
  - [8pts] Login rate limiting
  - [5pts] Session management

[SCRUMMASTER] Waiting 300s before next check...
```

### Monitoring Sprint Progress

On subsequent iterations:

```
[SCRUMMASTER] === Iteration 2 ===
[SCRUMMASTER] Checking for active sprint...
[SCRUMMASTER] Active sprint found: Sprint 3 - 2025-01-15 (ID: abc-def-ghi)
[SCRUMMASTER] Fetching sprint status...
[SPRINT] ════════════════════════════════════════
[SPRINT] Sprint Report: Sprint 3 - 2025-01-15
[SPRINT] ════════════════════════════════════════
[SPRINT] Sprint ID: abc-def-ghi
[SPRINT] Tasks: 12 / 25 completed
[SPRINT] Points: 18 / 39 completed
[SPRINT] Completion: 48%
[SPRINT] ════════════════════════════════════════
[SCRUMMASTER] Sprint in progress. Will check again in 300s
```

### Sprint Completion

When all tasks are done:

```
[SCRUMMASTER] === Iteration 15 ===
[SCRUMMASTER] Checking for active sprint...
[SCRUMMASTER] Active sprint found: Sprint 3 - 2025-01-15
[SCRUMMASTER] Fetching sprint status...
[SPRINT] ════════════════════════════════════════
[SPRINT] Sprint Report: Sprint 3 - 2025-01-15
[SPRINT] ════════════════════════════════════════
[SPRINT] Sprint ID: abc-def-ghi
[SPRINT] Tasks: 25 / 25 completed
[SPRINT] Points: 39 / 39 completed
[SPRINT] Completion: 100%
[SPRINT] ════════════════════════════════════════
[SCRUMMASTER] Sprint is complete! Closing sprint...
[SCRUMMASTER] Sprint closed successfully
[SCRUMMASTER] Next iteration will plan a new sprint

[SCRUMMASTER] === Iteration 16 ===
[SCRUMMASTER] Checking for active sprint...
[SCRUMMASTER] No active sprint found
[SCRUMMASTER] Initiating sprint planning...
...
```

## API Requirements

The Scrum Master agent requires these API endpoints:

### 1. Get Active Sprint

```http
GET /api/v1/projects/{project_id}/sprints/active
X-API-Key: battra-sm-key-1

Response:
{
  "id": "abc-def-ghi",
  "name": "Sprint 3 - 2025-01-15",
  "start_date": "2025-01-15",
  "end_date": "2025-01-29",
  "capacity_points": 40,
  "status": "active"
}

# Returns 404 if no active sprint
```

### 2. Get Ready Stories

```http
GET /api/v1/projects/{project_id}/stories?status=ready
X-API-Key: battra-sm-key-1

Response:
[
  {
    "id": "story-1-uuid",
    "title": "User authentication",
    "description": "Implement user login/logout",
    "estimated_points": 8,
    "status": "ready"
  },
  ...
]
```

### 3. Create Sprint

```http
POST /api/v1/projects/{project_id}/sprints
X-API-Key: battra-sm-key-1
Content-Type: application/json

Body:
{
  "name": "Sprint 3 - 2025-01-15",
  "start_date": "2025-01-15",
  "end_date": "2025-01-29",
  "capacity_points": 40,
  "story_ids": ["story-1-uuid", "story-2-uuid", ...]
}

Response:
{
  "id": "sprint-uuid",
  "name": "Sprint 3 - 2025-01-15",
  "start_date": "2025-01-15",
  "end_date": "2025-01-29",
  "capacity_points": 40,
  "status": "active"
}
```

### 4. Get Sprint Status

```http
GET /api/v1/sprints/{sprint_id}/status
X-API-Key: battra-sm-key-1

Response:
{
  "id": "sprint-uuid",
  "name": "Sprint 3 - 2025-01-15",
  "status": "active",
  "total_tasks": 25,
  "completed_tasks": 12,
  "in_progress_tasks": 8,
  "available_tasks": 5,
  "total_points": 39,
  "completed_points": 18
}
```

### 5. Complete Sprint

```http
POST /api/v1/sprints/{sprint_id}/complete
X-API-Key: battra-sm-key-1

Response:
{
  "id": "sprint-uuid",
  "name": "Sprint 3 - 2025-01-15",
  "status": "completed",
  "completed_at": "2025-01-29T18:30:00Z"
}
```

## Multi-Agent Coordination

### Complete Autonomous System

```
┌──────────────────────────────────────────────────────────┐
│              Scrum Master Agent (1)                       │
│  - Plans sprints                                         │
│  - Monitors progress                                     │
│  - Closes sprints                                        │
└────────────────────┬─────────────────────────────────────┘
                     │
                     │ Creates sprints with work
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│                  Active Sprint                            │
│  Stories → Tasks (ready to work)                         │
└────────────────────┬─────────────────────────────────────┘
                     │
                     │ Tasks available
                     │
      ┌──────────────┼──────────────┐
      ▼              ▼               ▼
┌──────────┐  ┌──────────┐    ┌──────────┐
│   Dev    │  │   Dev    │    │    QA    │
│ Agent 1  │  │ Agent 2  │    │  Agent   │
│          │  │          │    │          │
│ - Poll   │  │ - Poll   │    │ - Poll   │
│ - Take   │  │ - Take   │    │ - Take   │
│ - Code   │  │ - Code   │    │ - Test   │
│ - PR     │  │ - PR     │    │ - PR     │
│ - Done   │  │ - Done   │    │ - Done   │
└──────────┘  └──────────┘    └──────────┘
      │              │               │
      └──────────────┴───────────────┘
                     │
                     │ Tasks completed
                     ▼
┌──────────────────────────────────────────────────────────┐
│              Sprint Complete                              │
│  Scrum Master closes and plans next                     │
└──────────────────────────────────────────────────────────┘
```

### Starting All Agents

```bash
# Terminal 1: Start Scrum Master
export BATTRA_API_KEY=battra-sm-key-1
export BATTRA_PROJECT_ID=<project-uuid>
./scripts/scrummaster-agent.sh

# Terminal 2: Start Dev Agent 1
export BATTRA_API_KEY=battra-dev-key-1
export GIT_WORKFLOW_ENABLED=true
./scripts/autonomous-agent.sh battra-dev-key-1 <sprint-uuid> dev

# Terminal 3: Start Dev Agent 2
export BATTRA_API_KEY=battra-dev-key-2
export GIT_WORKFLOW_ENABLED=true
./scripts/autonomous-agent.sh battra-dev-key-2 <sprint-uuid> dev

# Terminal 4: Start QA Agent
export BATTRA_API_KEY=battra-qa-key-1
export GIT_WORKFLOW_ENABLED=true
./scripts/autonomous-agent.sh battra-qa-key-1 <sprint-uuid> qa
```

**Note:** Dev/QA agents need the sprint UUID. In a fully automated setup, they would query for the active sprint automatically. See `QUICK_START_FULL_AUTOMATION.md` for details.

## Benefits

### 1. Always Work Available

Scrum Master ensures there's always an active sprint, so dev agents never run out of work.

### 2. Automatic Sprint Cadence

Sprints automatically close when done and new ones are planned immediately.

### 3. Capacity Management

Stories are selected to fit sprint capacity, preventing overcommitment.

### 4. Progress Visibility

Regular progress reports show sprint health.

### 5. Hands-Off Operation

Once started, the system runs autonomously:
- Stories become ready → Scrum Master adds them to next sprint
- Agents complete tasks → Sprint progresses
- Sprint completes → New sprint planned automatically

## Metrics to Track

```typescript
interface ScrumMasterMetrics {
  sprintsPlanned: number;
  sprintsClosed: number;
  avgSprintPoints: number;
  avgSprintDuration: number;        // actual days
  avgTasksPerSprint: number;
  planningFailures: number;         // couldn't find stories
  sprintsClosedOnTime: number;      // vs. end_date
  avgStorySelectionTime: number;    // seconds
}
```

**Goal:** >90% sprints closed on time, <5% planning failures

## Troubleshooting

### "No ready stories found"

**Problem:** Sprint planning fails because no stories are ready.

**Solution:**
1. Check Readiness service
2. Ensure stories have acceptance criteria
3. Run readiness check manually
4. Verify story status in backlog

### "Sprint planning failed"

**Problem:** API call to create sprint fails.

**Solution:**
1. Check API logs
2. Verify API key permissions
3. Check story IDs are valid
4. Verify project exists

### "Sprint never completes"

**Problem:** Scrum Master doesn't close sprint even though tasks are done.

**Solution:**
1. Check sprint status API response
2. Verify `total_tasks` and `completed_tasks` match
3. Check for orphaned tasks
4. Manually close sprint via API if needed

### "AI selection fails"

**Problem:** AI strategy falls back to FIFO.

**Solution:**
1. Verify `ANTHROPIC_API_KEY` is set
2. Check API quota/limits
3. Review Claude API errors in logs
4. Use FIFO strategy as fallback

## Configuration Examples

### High-Throughput Team

```bash
export SPRINT_CAPACITY=60           # More points
export SPRINT_DURATION=7            # 1-week sprints
export POLL_INTERVAL=60             # Check every minute
```

### Conservative Team

```bash
export SPRINT_CAPACITY=30           # Fewer points
export SPRINT_DURATION=21           # 3-week sprints
export POLL_INTERVAL=600            # Check every 10 minutes
```

### AI-Optimized Planning

```bash
export SPRINT_SELECTION_STRATEGY=ai
export ANTHROPIC_API_KEY=sk-ant-...
export SPRINT_CAPACITY=40
```

## Future Enhancements

### Velocity Tracking

Adjust capacity based on team velocity:
```javascript
// Calculate avg velocity from last 3 sprints
const velocity = getAverageVelocity(lastThreeSprints);
const nextCapacity = velocity * 0.9; // 90% of avg velocity
```

### Priority Support

When priority field is available:
```sql
SELECT * FROM stories
WHERE status = 'ready'
ORDER BY priority DESC, created_at ASC
```

### Sprint Goals

Add sprint goals to guide story selection:
```javascript
const sprintGoal = "Launch authentication system";
// Select stories that align with goal
```

### Retrospective Reports

Generate end-of-sprint reports:
- What went well
- What didn't go well
- Velocity vs. capacity
- Action items for next sprint

## Summary

The Scrum Master agent completes the autonomous development loop:

1. ✅ **Plans sprints** from ready stories
2. ✅ **Monitors progress** continuously
3. ✅ **Closes sprints** when done
4. ✅ **Repeats indefinitely** (set it and forget it)

Combined with dev/qa agents, this creates a **fully autonomous development team**! 🎉
