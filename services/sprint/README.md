# Sprint Service

Sprint task board service providing real-time sprint management and task visibility.

## Overview

The Sprint service provides read-only views of sprint data and task boards for contributors. It integrates with the backlog service's WebSocket infrastructure to deliver real-time updates when tasks change.

## Features

- **Active Sprint Retrieval**: Get the currently active sprint for a project
- **Sprint Task Board**: View all tasks from all stories in a sprint with filtering and grouping
- **Real-Time Updates**: WebSocket integration for instant task status and ownership changes
- **Task Filtering**: Filter tasks by status, owner, or custom criteria
- **Task Grouping**: Group tasks by story or status for better visibility
- **Sprint Statistics**: Track sprint progress with completion percentages

## Architecture

This service follows **Hexagonal/Clean Architecture** principles:

```
services/sprint/
├── src/
│   ├── domain.rs          # Domain entities (Sprint, SprintStats, etc.)
│   ├── lib.rs             # SprintsUsecases (application layer)
│   └── adapters/
│       ├── http/          # HTTP handlers and routing
│       └── persistence/   # Database repositories
├── tests/
│   └── test_websocket_real_time_updates.rs  # @spec-test integration tests
└── docs/
    └── openapi.yaml       # API documentation
```

### Real-Time Updates

The Sprint service **consumes** WebSocket events from the backlog service at `/api/v1/ws/tasks`. When contributors:
- Take ownership of tasks
- Release ownership
- Change task status

...events are broadcast in real-time to all connected clients viewing the sprint task board.

**See:** [ADR-0006: Real-Time WebSocket Updates](../../docs/adr/ADR-0006-real-time-websocket-updates.md)

## API Endpoints

### Get Active Sprint
```
GET /api/v1/projects/{project_id}/sprints/active
```
Returns the currently active sprint for a project.

### Get Sprint Task Board
```
GET /api/v1/sprints/{sprint_id}/tasks?status={status}&owner_id={uuid}&group_by={story|status}
```
Returns all tasks from all stories in the sprint with optional filtering and grouping.

**Query Parameters:**
- `status` (optional): Filter by task status (available, owned, inprogress, completed)
- `owner_id` (optional): Filter by task owner UUID
- `group_by` (optional): Group tasks by "story" or "status"

**Response includes:**
- Sprint metadata (name, dates, days remaining)
- Sprint statistics (total stories, tasks, completion %)
- Tasks array with story information
- Grouped tasks (if requested)

### WebSocket Real-Time Updates
```
GET /api/v1/ws/tasks?token={jwt_token}
```
Establishes WebSocket connection for real-time task event notifications.

**Event Types:**
- `ownership_taken`: User took ownership of a task
- `ownership_released`: User released ownership
- `status_changed`: Task status updated

**Example:**
```javascript
const ws = new WebSocket('wss://api.example.com/api/v1/ws/tasks?token=' + jwtToken);

ws.onmessage = (event) => {
  const taskEvent = JSON.parse(event.data);

  switch(taskEvent.type) {
    case 'ownership_taken':
      // Update UI - task is now owned
      break;
    case 'ownership_released':
      // Update UI - task is available
      break;
    case 'status_changed':
      // Update UI - task status changed
      break;
  }
};
```

## Acceptance Criteria Mapping

This service satisfies the following acceptance criteria for the sprint task board story:

### AC#7852bac8: Display All Sprint Tasks
✅ **Implemented**: `GET /sprints/{sprint_id}/tasks` returns all tasks with:
- task_id, title, status
- owner_user_id and owner_name (if assigned)
- parent story_id and story_title
- acceptance_criteria_refs array

### AC#a2ef8786: Filtering and Grouping
✅ **Implemented**: Query parameters support:
- Status filtering: `?status=available`
- Owner filtering: `?owner_id={uuid}`
- Grouping by story: `?group_by=story`
- Grouping by status: `?group_by=status`
- Task count in each group

### AC#8e8e949d: Visual Task Distinction
✅ **Implemented**: Task response includes:
- `owner_user_id` field (null if available)
- `owner_name` field for display
- `status` field to distinguish states
- Frontend can highlight based on current user

### AC#728fd41e: Real-Time Updates
✅ **Implemented**: WebSocket endpoint `/api/v1/ws/tasks` provides:
- Real-time ownership taken events
- Real-time ownership released events
- Real-time status changed events
- No page refresh required
- Events include timestamp for notifications

### AC#d4d41a1f: Sprint Metadata
✅ **Implemented**: Sprint metadata includes:
- sprint.name, start_date, end_date
- sprint.days_remaining (calculated)
- stats.total_stories
- stats.total_tasks, completed_tasks
- stats.completion_percentage

## Testing

### Unit Tests (5 tests)
Located in `src/domain.rs`:
- Sprint metadata calculation
- Sprint stats calculation
- Task grouping by story
- Task grouping by status
- Zero tasks edge case

### Integration Tests (6 @spec-test tests)
Located in `tests/test_websocket_real_time_updates.rs`:
- ✅ `spec_test_websocket_broadcasts_ownership_taken` - Verifies ownership taken events
- ✅ `spec_test_websocket_broadcasts_ownership_released` - Verifies ownership released events
- ✅ `spec_test_websocket_broadcasts_status_changed` - Verifies status change events
- ✅ `spec_test_websocket_multiple_subscribers_receive_events` - Verifies multi-client broadcast
- ✅ `spec_test_websocket_event_serialization_for_json_transmission` - Verifies JSON encoding
- ✅ `spec_test_sprint_task_board_real_time_update_workflow` - Verifies end-to-end workflow

### Running Tests
```bash
# Run all sprint tests
cargo test -p sprint

# Run only WebSocket spec tests
cargo test -p sprint --test test_websocket_real_time_updates

# Run with output
cargo test -p sprint -- --nocapture
```

### Quality Checks
```bash
# Format code
cargo fmt --all

# Run linter
cargo clippy -p sprint --all-targets --all-features -- -D warnings
```

## Dependencies

**Runtime:**
- `tokio` - Async runtime
- `axum` - HTTP server framework
- `sqlx` - PostgreSQL database access
- `uuid` - UUID handling
- `chrono` - Date/time handling
- `serde` - Serialization
- `common` - Shared error handling and utilities

**Development:**
- `backlog` - WebSocket infrastructure for testing
- `serde_json` - JSON serialization for tests

## Database Schema

The Sprint service reads from these tables (owned by backlog service):
- `sprints` - Sprint metadata
- `stories` - Story information
- `tasks` - Task details with ownership and status

**Note:** Sprint service is **read-only**. All mutations happen in the backlog service.

## Environment Variables

None required - service uses shared database pool from API gateway.

## Development

### Local Development
```bash
# Run database migrations (if needed)
sqlx migrate run --source services/sprint/migrations

# Run service via API gateway
cargo shuttle run

# Access sprint endpoints
curl http://localhost:8000/api/v1/projects/{uuid}/sprints/active
curl http://localhost:8000/api/v1/sprints/{uuid}/tasks
```

### Adding New Endpoints

1. Define domain entities in `src/domain.rs`
2. Add use case methods to `SprintsUsecases` in `src/lib.rs`
3. Create HTTP handlers in `src/adapters/http/handlers.rs`
4. Add routes in API gateway `services/api-gateway/src/lib.rs`
5. Update OpenAPI spec in `docs/openapi.yaml`
6. Write unit and integration tests
7. Run `cargo fmt` and `cargo clippy`

## Deployment

Deployed as part of the unified API Gateway to Shuttle Cloud.

**Production URL:** `https://salunga-ai-vv2t.shuttle.app`

## Documentation

- **OpenAPI Spec**: [`docs/openapi.yaml`](docs/openapi.yaml)
- **Architecture**: [ADR-0006: Real-Time WebSocket Updates](../../docs/adr/ADR-0006-real-time-websocket-updates.md)
- **Project Charter**: [CLAUDE.md](../../CLAUDE.md)

## Contributing

Follow the project's contract-driven development approach:
1. Read the ADR for architectural decisions
2. Find `@spec-test` tests that define contracts
3. Implement functionality to make spec tests pass
4. Add additional edge case tests as needed
5. Ensure all quality checks pass

## License

Proprietary - Battra AI
