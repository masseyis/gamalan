# ADR-0006: Real-Time WebSocket Updates for Sprint Task Board

**Status:** Accepted
**Date:** 2025-01-04
**Deciders:** Architecture Team
**Related:** AC#728fd41e (Real-time board updates)

## Context

The sprint task board needs to provide real-time updates to all connected users when:
- A contributor takes ownership of a task
- A contributor releases ownership of a task
- A task status changes

Without real-time updates, users would need to manually refresh the page to see changes made by other contributors, leading to:
- Potential conflicts (two users trying to take the same task)
- Stale data on the board
- Poor user experience

## Decision

We have implemented a WebSocket-based event broadcasting system that:

1. **Uses Tokio broadcast channels** for efficient event distribution to multiple subscribers
2. **Integrates with existing backlog service** where task mutations occur
3. **Broadcasts three types of events:**
   - `OwnershipTaken`: When a user takes ownership of a task
   - `OwnershipReleased`: When a user releases ownership
   - `StatusChanged`: When a task status is updated

4. **Provides authenticated WebSocket endpoint** at `/api/v1/ws/tasks`
5. **Supports both JWT and API Key authentication** via query parameters for WebSocket compatibility

## Architecture

### Event Flow

```
Task Mutation (HTTP Handler)
    ↓
Domain Event Created (TaskEvent)
    ↓
WebSocketManager.broadcast()
    ↓
Tokio Broadcast Channel
    ↓
All Connected WebSocket Clients
```

### Components

#### Domain Layer: `TaskEvent` enum
```rust
pub enum TaskEvent {
    OwnershipTaken {
        task_id: Uuid,
        story_id: Uuid,
        owner_user_id: Uuid,
        timestamp: DateTime<Utc>,
    },
    OwnershipReleased {
        task_id: Uuid,
        story_id: Uuid,
        previous_owner_user_id: Uuid,
        timestamp: DateTime<Utc>,
    },
    StatusChanged {
        task_id: Uuid,
        story_id: Uuid,
        old_status: String,
        new_status: String,
        changed_by_user_id: Uuid,
        timestamp: DateTime<Utc>,
    },
}
```

#### Adapter Layer: `WebSocketManager`
```rust
pub struct WebSocketManager {
    tx: broadcast::Sender<TaskEvent>,
}

impl WebSocketManager {
    pub fn new(capacity: usize) -> Self;
    pub fn broadcast(&self, event: TaskEvent);
    pub fn subscribe(&self) -> broadcast::Receiver<TaskEvent>;
}
```

#### HTTP Handler Integration
- Task ownership endpoints call `ws_manager.broadcast()` after successful mutations
- Events are broadcast **after** database commit to ensure consistency
- No blocking operations in broadcast path (fire-and-forget)

### WebSocket Authentication

Since WebSocket handshake happens via HTTP Upgrade, standard header-based auth works. However, for browser clients that cannot set custom headers during WebSocket connection, we support query parameters:

- `?token={jwt_token}` - For Clerk JWT authentication
- `?api_key={key}` - For API key authentication

The `WsAuthenticatedWithOrg` extractor handles both methods.

### Client Usage

Frontend clients connect to WebSocket and receive JSON events:

```javascript
const ws = new WebSocket(`wss://api.example.com/api/v1/ws/tasks?token=${jwtToken}`);

ws.onmessage = (event) => {
  const taskEvent = JSON.parse(event.data);

  switch(taskEvent.type) {
    case 'ownership_taken':
      // Update UI to show task is now owned
      break;
    case 'ownership_released':
      // Update UI to show task is available
      break;
    case 'status_changed':
      // Update task status in UI
      break;
  }
};
```

## Technical Decisions

### 1. Tokio Broadcast Channel
**Chosen:** Tokio's `broadcast::channel`
**Alternatives considered:**
- Custom pub-sub implementation (unnecessary complexity)
- External message broker like Redis Pub/Sub (over-engineering for current scale)

**Rationale:**
- Built-in to Tokio runtime
- Zero additional dependencies
- Efficient for fan-out to multiple subscribers
- Handles subscriber lag gracefully (messages dropped if receiver is slow)
- Bounded channel prevents memory leaks

### 2. Event Location: Backlog Service
**Chosen:** Events originate in backlog service where task mutations occur
**Alternatives considered:**
- Separate event service
- Events in sprint service

**Rationale:**
- Single source of truth (backlog owns task state)
- No additional network hops
- Simpler architecture
- Sprint service consumes events, doesn't produce them

### 3. Event Broadcasting Pattern
**Chosen:** Broadcast after DB commit, fire-and-forget
**Alternatives considered:**
- Transactional outbox pattern
- Event sourcing
- At-least-once delivery guarantees

**Rationale:**
- Sprint task board is read-heavy, eventual consistency is acceptable
- Clients can refresh on reconnect if they miss events
- Simpler implementation without distributed transaction complexity
- Best-effort delivery sufficient for UI updates

### 4. WebSocket vs Server-Sent Events (SSE)
**Chosen:** WebSocket
**Alternatives considered:**
- Server-Sent Events (SSE)
- Long polling

**Rationale:**
- Bidirectional communication (can add client → server messages later)
- Better browser support than SSE
- Industry standard for real-time updates
- Existing Axum support via `axum::extract::ws`

## Implementation Details

### Service Integration

1. **Backlog Service (`services/backlog`)**:
   - `src/domain/events.rs` - Event definitions
   - `src/adapters/websocket/mod.rs` - WebSocket handler and manager
   - `src/adapters/http/state.rs` - WebSocketManager in app state
   - `src/adapters/http/handlers.rs` - Event broadcasting in mutation handlers

2. **API Gateway (`services/api-gateway`)**:
   - Route: `GET /api/v1/ws/tasks` → `websocket_handler`
   - Shared WebSocketManager instance across all requests
   - CORS configured for WebSocket upgrade

### Testing Strategy

1. **Unit Tests** (`services/backlog/src/adapters/websocket/mod.rs`):
   - WebSocketManager creation and subscription
   - Event broadcast to single subscriber
   - Event broadcast to multiple subscribers

2. **Integration Tests** (`services/backlog/tests/integration/test_websocket_events.rs`):
   - OwnershipTaken event broadcast
   - OwnershipReleased event broadcast
   - StatusChanged event broadcast
   - Multiple subscribers receive same event
   - Event serialization/deserialization

3. **E2E Tests** (Frontend):
   - Connect to WebSocket
   - Verify events received when other user takes task
   - Verify events received when other user releases task
   - Verify events received when task status changes

## Consequences

### Positive

- **Real-time UX**: Users see changes immediately without refreshing
- **Reduced conflicts**: Users instantly see when tasks are taken
- **Scalable**: Broadcast channel can handle hundreds of concurrent connections
- **Simple**: No external dependencies or complex infrastructure
- **Testable**: Easy to unit test event broadcasting

### Negative

- **Eventual consistency**: Brief window where client state may lag server state
- **Connection overhead**: Each connected client holds open WebSocket connection
- **No message history**: Clients that disconnect miss events (must refresh on reconnect)
- **Single instance limitation**: Current implementation doesn't scale across multiple API gateway instances (would need Redis Pub/Sub)

### Mitigation Strategies

1. **Connection overhead**: Use WebSocket connection pooling and heartbeat/ping-pong
2. **Missed events**: Client refetches task board data on reconnect
3. **Multi-instance scaling**: When needed, migrate to Redis Pub/Sub (see ADR-FUTURE)

## Acceptance Criteria Mapping

This ADR satisfies **AC#728fd41e**:

> **Given:** I am viewing the sprint task board
> **When:** Another contributor takes ownership of a task or changes task status
> **Then:** The board should update in real-time without requiring a page refresh, and I should see a subtle notification of the change

**Implementation:**
- ✅ WebSocket connection provides real-time updates
- ✅ Events broadcast when ownership taken/released
- ✅ Events broadcast when status changes
- ✅ No page refresh required (WebSocket push)
- ✅ Frontend can display notification based on event type

## Future Considerations

1. **Multi-instance deployment**: Implement Redis Pub/Sub for cross-instance event distribution
2. **Event persistence**: Consider transactional outbox pattern for guaranteed delivery
3. **Event filtering**: Allow clients to subscribe to specific stories/sprints only
4. **Compression**: Use WebSocket compression for large deployments
5. **Metrics**: Add Prometheus metrics for WebSocket connection count and event throughput

## References

- [Tokio Broadcast Channel Documentation](https://docs.rs/tokio/latest/tokio/sync/broadcast/index.html)
- [Axum WebSocket Example](https://github.com/tokio-rs/axum/blob/main/examples/websockets/src/main.rs)
- Source: `services/backlog/src/adapters/websocket/mod.rs`
- Tests: `services/backlog/tests/integration/test_websocket_events.rs`
- Endpoint: `GET /api/v1/ws/tasks` in API Gateway
