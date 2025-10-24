# ADR-0004: Context Orchestrator Service Implementation

**Status:** Accepted  
**Date:** 2025-01-09  
**Decision Makers:** Claude Code (AI Assistant)  
**Related:** [ADR-0001](ADR-0001-architecture.md) (Hexagonal Architecture), [ADR-0002](ADR-0002-ai-agent-prompts.md) (AI Agent Prompts)

## Context

The Salunga AI-Agile platform requires a sophisticated natural language processing service that can:

1. **Intent Parsing**: Interpret user utterances in the context of agile project management
2. **Entity Resolution**: Map natural language references to specific project entities (stories, tasks, etc.)
3. **Action Orchestration**: Coordinate actions across multiple downstream services
4. **Context Management**: Maintain semantic understanding of project state and relationships
5. **Fallback Handling**: Provide heuristic parsing when LLM services are unavailable

The existing services (auth-gateway, projects, backlog, readiness, prompt-builder) handle specific domain concerns but lack a unified natural language interface for user interactions.

## Decision

We will implement a **Context Orchestrator Service** as a new microservice with the following architecture:

### Core Responsibilities

- **Natural Language Intent Parsing** using OpenAI GPT models with structured JSON output
- **Vector-based Entity Search** using Qdrant vector database for semantic similarity
- **Action Validation & Execution** with tenant isolation and permission checks
- **Service Orchestration** across backlog, readiness, and prompt-builder services
- **Rate Limiting & Security** for multi-tenant usage

### Technical Architecture

#### Domain Model

```rust
// Core entities following DDD principles
pub struct IntentRecord {
    pub tenant_id: Uuid,
    pub user_id: Uuid,
    pub utterance_hash: String,
    pub parsed_intent: ParsedIntent,
    pub llm_confidence: f32,
    pub service_confidence: f32,
    // ...
}

pub struct ActionCommand {
    pub action_type: ActionType,
    pub target_entities: Vec<Uuid>,
    pub parameters: HashMap<String, Value>,
    pub risk_level: RiskLevel,
    // ...
}
```

#### Hexagonal Architecture Layers

**Domain Layer** (`src/domain/`):

- Pure business logic with no external dependencies
- Entity models, value objects, and business rules
- Action validation and candidate selection logic
- Intent parsing with fallback heuristics

**Application Layer** (`src/application/`):

- Use cases: `InterpretUseCase`, `ActUseCase`
- Port definitions (traits) for external dependencies
- Service orchestration and workflow coordination

**Adapter Layer** (`src/adapters/`):

- **HTTP**: Axum REST handlers with JSON serialization
- **Persistence**: PostgreSQL (intent history) + Qdrant (vector search)
- **Integrations**: OpenAI client, service HTTP clients

#### API Design

Two primary endpoints following RESTful conventions:

```yaml
POST /interpret
- Input: Natural language utterance + context preferences
- Output: Structured intent + entity candidates + confidence scores

POST /act
- Input: Structured action command + confirmation tokens
- Output: Execution results from downstream services
```

#### Technology Stack

- **Rust 2021** with async/await for high-performance concurrent processing
- **Axum** for HTTP server with middleware support
- **PostgreSQL** via SQLx for intent history and audit trails
- **Qdrant** for vector similarity search of project entities
- **OpenAI API** for LLM-based intent parsing
- **Shuttle** for cloud deployment with managed resources

### Key Architectural Decisions

#### 1. Vector Search Strategy

- **Embedding Generation**: Use OpenAI text-embedding-3-small (1536 dimensions)
- **Storage**: Qdrant collection with tenant-based filtering
- **Boosting**: Exact title matches get similarity score boosts
- **Fallback**: Keyword-based matching when vector search fails

#### 2. LLM Integration Pattern

- **Structured Output**: JSON schema validation for consistent parsing
- **Prompt Engineering**: System prompts with entity context and examples
- **Error Handling**: Graceful degradation to heuristic parsing
- **Rate Limiting**: Per-tenant token bucket limiting

#### 3. Service Orchestration

- **Async Coordination**: Parallel calls to downstream services where possible
- **Partial Success**: Track individual service results with rollback tokens
- **Circuit Breaker**: Service health checks with fallback responses

#### 4. Security & Isolation

- **Tenant Isolation**: All queries filtered by tenant_id at database level
- **JWT Authentication**: Clerk-based authentication with role extraction
- **Action Validation**: Risk assessment with confirmation requirements
- **Audit Logging**: All actions logged with user attribution

## Rationale

### Why a Dedicated Service?

1. **Separation of Concerns**: Natural language processing is a distinct domain from project management
2. **Scalability**: Can scale independently based on user interaction patterns
3. **Technology Specialization**: Requires ML/AI libraries not needed by other services
4. **Failure Isolation**: LLM service outages don't impact core project management features

### Why Rust + Axum?

1. **Performance**: High-throughput request processing with minimal latency
2. **Type Safety**: Prevents common errors in complex data transformations
3. **Async Support**: Excellent support for concurrent I/O operations
4. **Ecosystem**: Strong libraries for JSON, HTTP, and database interactions

### Why Vector Search + LLM Hybrid?

1. **Context Relevance**: Vector similarity finds semantically related entities
2. **Intent Accuracy**: LLM parsing handles complex linguistic patterns
3. **Reliability**: Heuristic fallbacks ensure service availability
4. **Performance**: Cached embeddings reduce API costs

### Why Hexagonal Architecture?

1. **Testability**: Clean separation enables comprehensive unit testing
2. **Maintainability**: Clear boundaries between business logic and infrastructure
3. **Flexibility**: Easy to swap implementations (e.g., different LLM providers)
4. **Documentation**: Architecture enforces clear interface contracts

## Implementation Details

### Database Schema

```sql
-- Intent history for analytics and debugging
CREATE TABLE intent_history (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    utterance_hash VARCHAR(64) NOT NULL,
    parsed_intent JSONB NOT NULL,
    llm_confidence REAL NOT NULL,
    service_confidence REAL NOT NULL,
    candidates JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rate limiting buckets
CREATE TABLE rate_limit_buckets (
    user_id UUID NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    token_count INTEGER NOT NULL,
    last_refill TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (user_id, resource_type)
);
```

### Qdrant Collection Schema

```rust
// Vector collection for semantic entity search
Collection: "context_entities"
Vector Size: 1536 (OpenAI embedding dimensions)
Payload Schema: {
    tenant_id: UUID,
    entity_type: String, // "story", "task", "project", etc.
    title: String,
    description: Option<String>,
    status: Option<String>,
    metadata: HashMap<String, Value>
}
```

### Service Integration Pattern

```rust
// Downstream service coordination
pub async fn execute_action(&self, command: ActionCommand) -> Result<ActResult> {
    let results = match command.action_type {
        ActionType::UpdateStatus => {
            self.backlog_client.update_story_status(/* ... */).await?
        }
        ActionType::CreateTask => {
            let story_result = self.backlog_client.create_task(/* ... */).await?;
            let readiness_result = self.readiness_client.check_story_readiness(/* ... */).await?;
            vec![story_result, readiness_result]
        }
        // ... other actions
    };

    Ok(ActResult {
        success: results.iter().all(|r| r.success),
        results,
        rollback_token: Some(Uuid::new_v4()),
        partial_success: results.iter().any(|r| !r.success),
    })
}
```

## Consequences

### Positive

1. **User Experience**: Natural language interface dramatically improves usability
2. **Developer Productivity**: Reduces need for complex UI interactions
3. **Extensibility**: Easy to add new intent types and action handlers
4. **Observability**: Comprehensive logging and metrics for AI interactions
5. **Cost Efficiency**: Cached embeddings and heuristic fallbacks minimize API costs

### Negative

1. **Complexity**: Adds significant architectural complexity to the platform
2. **Dependencies**: Creates new external dependencies on OpenAI and Qdrant
3. **Latency**: Additional service hops increase request response times
4. **Cost**: LLM API usage and vector database hosting add operational costs
5. **Debugging**: AI-based decisions can be harder to debug and troubleshoot

### Mitigation Strategies

1. **Fallback Systems**: Heuristic parsing ensures availability during outages
2. **Performance Monitoring**: Detailed metrics and alerts for response times
3. **Cost Controls**: Rate limiting and caching to manage API usage
4. **Testing Strategy**: Comprehensive unit tests for deterministic code paths
5. **Documentation**: Clear API documentation and operational runbooks

## Related Decisions

- **ADR-0001**: Establishes hexagonal architecture principles followed here
- **ADR-0002**: Defines prompt engineering standards for LLM integration
- **Future ADR**: Will document service mesh communication patterns
- **Future ADR**: Will address cross-service transaction handling

## References

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Qdrant Vector Database](https://qdrant.tech/documentation/)
- [Axum Web Framework](https://docs.rs/axum/latest/axum/)
- [Shuttle Rust Platform](https://docs.shuttle.rs/)
- [Clean Architecture Principles](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
