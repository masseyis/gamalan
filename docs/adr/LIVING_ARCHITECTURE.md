# Living Architecture Documentation

This document tracks the evolution of the Salunga AI-Agile platform architecture, providing a running summary of significant architectural changes and decisions.

## Current Architecture Overview

**Last Updated:** 2025-09-02  
**Services:** Single API Gateway + Service Libraries  
**Architecture Pattern:** Hexagonal/Clean Architecture with Shared Gateway  
**Communication:** Internal library calls via unified HTTP API  
**Persistence:** PostgreSQL + Qdrant Vector Database  
**Authentication:** Clerk JWT  
**Deployment:** Single Shuttle Cloud Deployment  

## Service Topology

```mermaid
graph TB
    Client[Web Client] --> Gateway[API Gateway - salunga-ai-vv2t.shuttle.app]
    
    subgraph "Single Deployment"
        Gateway --> Auth[Auth Routes /auth]
        Gateway --> Projects[Projects Routes /api/v1/projects]
        Gateway --> Backlog[Backlog Routes /api/v1/stories]
        Gateway --> Readiness[Readiness Routes /api/v1/readiness]
        Gateway --> PromptBuilder[Prompt Builder Routes /api/v1/prompts]
        
        Auth -.-> AuthLib[auth-gateway lib]
        Projects -.-> ProjectsLib[projects lib]
        Backlog -.-> BacklogLib[backlog lib] 
        Readiness -.-> ReadinessLib[readiness lib]
        PromptBuilder -.-> PromptBuilderLib[prompt-builder lib]
    end
    
    Gateway --> DB[(PostgreSQL)]
    Gateway --> Qdrant[(Qdrant Vector DB)]
    Gateway --> OpenAI[OpenAI API]
```

## Architecture Changelog

### 2025-09-07: Shuttle-Managed Database Architecture Enforcement
**Scope:** Database architecture compliance and documentation  
**Decision Reference:** [ADR-0005: Shuttle-Managed Database Architecture](ADR-0005-shuttle-managed-databases.md)  

#### Changes Made
- **Database Dependencies:** Removed all external DATABASE_URL references from deployment workflows
- **CI/CD Compliance:** Updated GitHub Actions to rely solely on Shuttle's managed Postgres
- **Documentation:** Created ADR-0005 to prevent future regressions to external database dependencies
- **Workflow Updates:** Modified deploy.yml, main.yml, and initial-deploy.yml to use Shuttle-provided databases

#### Database Architecture Pattern
- **Database Provisioning:** All services use `#[Postgres]` annotation for automatic database management
- **Local Development:** Uses `local_uri = "postgres://postgres:password@localhost:5432/gamalan"`
- **Production/Staging:** Shuttle automatically provisions and manages PostgreSQL databases
- **Zero External Dependencies:** No AWS RDS, Neon, or other external database providers

#### Compliance Rules Established
- ✅ **DO:** Use `#[Postgres]` annotation for all database needs
- ✅ **DO:** Rely on Shuttle's automatic database provisioning
- ❌ **DON'T:** Add DATABASE_URL to GitHub Actions workflows
- ❌ **DON'T:** Use external database providers

#### Files Modified
- `.github/workflows/deploy.yml` - Removed DATABASE_URL from production deployment
- `.github/workflows/main.yml` - Removed DATABASE_URL from staging deployment  
- `.github/workflows/initial-deploy.yml` - Removed DATABASE_URL from bootstrap deployment
- `docs/adr/ADR-0005-shuttle-managed-databases.md` - Created architectural decision record

#### Architectural Impact
- **Simplified Infrastructure:** Complete elimination of external database dependencies
- **Cost Reduction:** No separate database hosting costs
- **Operational Simplicity:** Shuttle handles all database scaling, backups, and maintenance
- **Deployment Reliability:** Automatic database provisioning during service deployment
- **Security Enhancement:** No need to manage database credentials or connection strings

### 2025-09-04: JWT Authentication and Service Compilation Fixes
**Scope:** Authentication system and service compilation improvements  
**Commit:** 908cb7f  
**PR:** N/A (Direct commit)  

#### Changes Made
- **JWT Authentication:** Fixed Clerk JWT compatibility by making `aud` field optional in Claims struct
- **Service Dependencies:** Resolved missing dependencies in context-orchestrator service 
- **Service Integration:** Fixed router function imports and init_tracing calls across all services
- **Compilation:** Ensured all services compile both as binaries and libraries for api-gateway
- **Code Quality:** Applied formatting and maintained hexagonal architecture boundaries

#### JWT Verification Updates
- **Claims Structure:** `libs/auth_clerk/src/claims.rs` - Made `aud` field `Option<String>`
- **Verifier Logic:** `libs/auth_clerk/src/lib.rs` - Added optional audience validation with bypass
- **Service Integration:** Updated all service instantiations to use new JwtVerifier signature
- **Test Coverage:** Updated JWT verifier tests to match new optional audience parameter

#### Context-Orchestrator Dependencies
- **Added Dependencies:** uuid, chrono, serde, qdrant-client, async-openai, async-trait, reqwest
- **Package Fixes:** Corrected qdrant_client → qdrant-client package name
- **Compilation:** Service now compiles successfully with all required dependencies

#### Service Integration Improvements  
- **Router Functions:** Fixed imports from `app_router` to `create_*_router` pattern
- **Tracing Calls:** Added service name parameters to all `init_tracing()` calls
- **Library Exports:** Ensured all services properly export router creation functions
- **API Gateway:** Confirmed unified gateway can import and use all service libraries

#### Architectural Impact
- **Authentication:** Clerk JWT tokens now work without custom templates
- **Service Compilation:** All services compile without errors or warnings
- **Deployment Flexibility:** Services work as both standalone binaries and gateway libraries
- **Development Experience:** No compilation blockers for local development

#### Technical Details
- **Files Modified:** 41 files across libs and services directories
- **Lines Changed:** 1397 insertions, 707 deletions
- **New Files:** Added error_context.rs and observability.rs to common lib
- **Architecture Compliance:** Maintained hexagonal architecture boundaries throughout

### 2025-09-02: Microservices Consolidated to API Gateway Pattern
**Scope:** Major architectural refactoring  
**Decision Reference:** Converted microservices to library modules with unified gateway  

#### Changes Made
- **Architecture Pattern:** Microservices → Monolithic deployment with library modules
- **Deployment Model:** Multiple Shuttle projects → Single `api-gateway` deployment  
- **Service Libraries:** Converted standalone services to reusable library crates
- **Unified Routing:** Single entry point with path-based routing (`/api/v1/*`, `/auth/*`)
- **Shared Resources:** Consolidated database pool and JWT verifier across services

#### Service Route Mapping
- **Auth Service:** `/auth/*` - User authentication and management
- **Projects Service:** `/api/v1/projects/*` - Project CRUD operations  
- **Backlog Service:** `/api/v1/stories/*` - Story and task management
- **Readiness Service:** `/api/v1/readiness/*` - Story readiness assessment
- **Prompt Builder Service:** `/api/v1/prompts/*` - AI prompt generation

#### Technical Implementation
- **Main Gateway:** `services/api-gateway/src/main.rs` - Unified router with service nesting
- **Service Libraries:** Each service converted to lib crate with `create_*_router()` function
- **Shared Dependencies:** Database pool and JWT verifier passed to all service routers
- **CORS & Middleware:** Centralized middleware stack with tracing and CORS

#### Deployment Details
- **Shuttle Project:** `salunga-ai` deployed to `https://salunga-ai-vv2t.shuttle.app`
- **Health Endpoints:** `/health` and `/ready` at root level
- **Database:** Single PostgreSQL connection shared across all services
- **Authentication:** Centralized Clerk JWT verification

#### Architectural Benefits
- **Simplified Deployment:** Single deployment unit reduces operational complexity
- **Shared Resources:** Efficient resource utilization with connection pooling
- **Unified API:** Single base URL for all client requests
- **Faster Local Development:** No need to run multiple services locally
- **Cost Optimization:** Single Shuttle instance instead of multiple deployments

#### Migration Impact
- **Frontend Changes Required:** API base URLs must point to single gateway
- **Service Independence:** Services still maintain hexagonal architecture internally
- **Library Isolation:** Each service maintains its own domain/application/adapter structure
- **Database Isolation:** Each service still owns its database tables/schema

### 2025-01-09: Context Orchestrator Service Added
**Scope:** New microservice implementation  
**Decision Reference:** [ADR-0004](ADR-0004-context-orchestrator-service.md)  

#### Changes Made
- **New Service:** `services/context-orchestrator` (port 8003)
- **New Database:** Qdrant vector database integration
- **New External API:** OpenAI LLM integration
- **Enhanced Authentication:** Clerk JWT verification in shared library

#### Service Architecture
- **Hexagonal Architecture:** Strict domain/application/adapter separation
- **Domain Layer:** Intent parsing, action validation, candidate selection
- **Application Layer:** Use cases for interpret and act workflows
- **Adapter Layer:** HTTP/JSON, PostgreSQL, Qdrant, OpenAI integrations

#### API Endpoints
- `POST /interpret` - Natural language intent parsing
- `POST /act` - Structured action execution  
- `GET /health` - Service health check
- `GET /ready` - Dependency readiness check

#### Database Schema Extensions
- **PostgreSQL Tables:**
  - `intent_history` - Intent parsing audit trail
  - `rate_limit_buckets` - Per-user rate limiting
- **Qdrant Collection:**
  - `context_entities` - Vector embeddings for semantic search

#### Service Dependencies
- **Downstream:** backlog (8002), readiness (8004), prompt-builder (8005)
- **External:** OpenAI API, Qdrant vector database
- **Shared Libraries:** common, auth_clerk

#### Key Technical Decisions
1. **LLM Integration:** OpenAI GPT models with structured JSON output
2. **Vector Search:** Qdrant with text-embedding-3-small (1536d)
3. **Fallback Strategy:** Heuristic parsing when LLM unavailable
4. **Security Model:** Tenant isolation + JWT authentication
5. **Performance:** Async Rust with connection pooling

#### Architectural Impact
- **Positive:** Enables natural language interactions, improves user experience
- **Complexity:** Adds AI/ML dependencies and vector database management
- **Service Mesh:** Establishes multi-service orchestration patterns

#### Testing Strategy
- **Unit Tests:** 40+ tests covering domain logic and use cases
- **Integration Tests:** HTTP handler and DTO serialization validation
- **Mock Objects:** Complete test doubles for external dependencies
- **Coverage:** Focus on business logic validation and error handling

### Future Architecture Considerations
- **Service Mesh:** Consider Istio/Linkerd for inter-service communication
- **Event Streaming:** Evaluate Apache Kafka for async event processing
- **CQRS Pattern:** Separate read/write models for complex query patterns
- **Circuit Breakers:** Implement circuit breaker pattern for resilience

## Service Details

### context-orchestrator (Port 8003)
**Purpose:** Natural language processing and action orchestration  
**Language:** Rust  
**Framework:** Axum  
**Database:** PostgreSQL + Qdrant  
**External APIs:** OpenAI  

**Key Responsibilities:**
- Natural language intent parsing with LLM integration
- Vector-based semantic entity search  
- Multi-service action coordination
- Tenant-isolated request processing
- Rate limiting and security enforcement

**Domain Entities:**
- `IntentRecord` - Parsed intent with confidence scores
- `ActionCommand` - Structured action with risk assessment  
- `CandidateEntity` - Project entity with similarity scoring
- `ContextSnapshot` - Point-in-time project context

### auth-gateway (Port 8000)  
**Purpose:** Authentication, authorization, and request routing  
**Status:** Existing service  

### projects (Port 8001)
**Purpose:** Project and workspace management  
**Status:** Existing service  

### backlog (Port 8002)
**Purpose:** Story and task management  
**Status:** Existing service  
**Integrations:** Called by context-orchestrator for action execution

### readiness (Port 8004)  
**Purpose:** Story readiness assessment and validation  
**Status:** Existing service  
**Integrations:** Called by context-orchestrator for readiness checks

### prompt-builder (Port 8005)
**Purpose:** AI prompt generation and context building  
**Status:** Existing service  
**Integrations:** Called by context-orchestrator for context prompts

## Shared Libraries

### common
**Purpose:** Shared error handling, HTTP utilities, tracing  
**Path:** `libs/common`  
**Key Components:**
- `AppError` - Standardized error types
- HTTP middleware and utilities  
- Structured logging and correlation IDs

### auth_clerk  
**Purpose:** Clerk JWT verification and user extraction  
**Path:** `libs/auth_clerk`  
**Key Components:**
- `Authenticated` - JWT verification extractor
- JWKS key management and caching
- User identity extraction from tokens

## Data Architecture

### PostgreSQL Databases
- **Per-service databases:** Each service owns its data
- **Connection pooling:** SQLx with configurable pool sizes
- **Migrations:** Service-specific migration management
- **Tenant isolation:** All tables include tenant_id columns

### Qdrant Vector Database  
- **Purpose:** Semantic similarity search for project entities
- **Collections:** `context_entities` with 1536-dimension embeddings
- **Indexing:** Tenant-based filtering with metadata
- **Performance:** In-memory vectors with disk persistence

## Deployment Architecture

### Shuttle Platform
- **Per-service deployment:** Independent scaling and versioning
- **Managed resources:** Automatic database and secret provisioning  
- **Environment isolation:** Development and production environments
- **Health checks:** Built-in readiness and liveness probes

### Configuration Management
- **Environment variables:** Service-specific configuration
- **Secrets management:** Shuttle-managed secret injection
- **Feature flags:** Environment-based feature toggling

## Quality Assurance

### Testing Standards
- **Unit Test Coverage:** ≥85% for all business logic
- **Integration Tests:** HTTP endpoints and database operations  
- **Contract Tests:** OpenAPI specification compliance
- **Property-Based Tests:** Domain invariant validation

### Code Quality
- **Linting:** `cargo clippy` with strict warnings
- **Formatting:** `cargo fmt` with consistent styling  
- **Security:** Regular dependency audits and vulnerability scanning
- **Documentation:** Inline code docs and API specifications

### CI/CD Pipeline
- **Build Verification:** Format, lint, test, coverage on every PR
- **Deployment:** Automated deployment on tag creation
- **Monitoring:** Service health checks and performance metrics

## Observability

### Logging
- **Structured Logging:** JSON format with correlation IDs
- **Log Aggregation:** Centralized logging across all services
- **Log Levels:** Configurable per service and environment

### Metrics  
- **Application Metrics:** Request counts, response times, error rates
- **Business Metrics:** Intent parsing success rates, action completion rates
- **Infrastructure Metrics:** Database connections, memory usage, CPU utilization

### Tracing
- **Distributed Tracing:** Request flow across service boundaries
- **Performance Profiling:** Bottleneck identification and optimization
- **Error Tracking:** Exception capture and analysis

## Security Architecture

### Authentication & Authorization
- **Identity Provider:** Clerk for user authentication
- **Token Verification:** JWT with JWKS validation
- **Session Management:** Stateless token-based sessions

### Data Protection
- **Tenant Isolation:** Database-level data segregation  
- **Data Encryption:** TLS in transit, database encryption at rest
- **API Security:** Rate limiting, input validation, output sanitization

### Compliance
- **Privacy:** GDPR-compliant data handling and retention
- **Audit Trails:** Complete action logging with user attribution
- **Access Controls:** Role-based permission enforcement

## Performance Characteristics

### Scalability
- **Horizontal Scaling:** Stateless services support multiple instances
- **Database Scaling:** Connection pooling and read replicas  
- **Caching:** In-memory caching for frequently accessed data

### Latency Targets
- **API Response Time:** <200ms for 95th percentile
- **LLM Integration:** <2s for intent parsing operations
- **Vector Search:** <100ms for similarity queries

### Throughput
- **Concurrent Users:** Designed for 1000+ concurrent users
- **Request Rate:** 10,000+ requests per minute across all services
- **Batch Processing:** Bulk operations for data imports/exports

---

**Document Maintenance:**  
This document is automatically updated when architectural changes are made.  
For questions or clarifications, see the individual ADRs referenced above.