# Deployment Guide

## Overview

Salunga uses a consolidated API Gateway deployment architecture with comprehensive CI/CD pipeline, feature flag-based releases, canary deployments, and automated rollback capabilities. **All services (projects, backlog, readiness, prompt-builder, context-orchestrator) are deployed as a single API Gateway binary** while maintaining modular architecture for future microservice scaling.

### Architecture Model

- **Single Deployment**: All services consolidated into api-gateway binary
- **Modular Design**: Services remain architecturally separate within codebase
- **Unified API**: All endpoints accessible through single gateway
- **Shuttle Optimization**: Uses only 3 Shuttle projects (fits free tier)
- **Future-Ready**: Can easily scale to independent microservices when needed

## Pipeline Architecture

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│   Feature   │    │      PR      │    │   Staging   │    │  Production  │
│   Branch    │───▶│  Validation  │───▶│ Deployment  │───▶│    Canary    │
│             │    │              │    │             │    │  Deployment  │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
```

### Environments

- **Development**: Local development with Docker Compose
- **Staging**: Automatic deployment on merge to `main` (`salunga-ai-staging`)
- **Production**: Manual approval with canary deployment strategy (`salunga-ai`)
- **Canary**: Temporary canary deployment for progressive rollout (`salunga-ai-canary`)

### Consolidated Service Architecture

All services are deployed as a **single API Gateway binary** while maintaining clean architectural boundaries:

```
api-gateway (Single Deployment)
├── /api/v1/projects/*          → Projects service
├── /api/v1/backlog/*           → Backlog service
├── /api/v1/readiness/*         → Readiness service
├── /api/v1/prompt-builder/*    → Prompt Builder service
└── /api/v1/context-orchestrator/* → Context Orchestrator service
```

**Benefits:**

- **Cost Efficiency**: Uses only 3 Shuttle projects (fits free tier)
- **Deployment Simplicity**: Single binary to deploy and monitor
- **Development Speed**: Faster local development and testing
- **Architectural Integrity**: Services remain modular for future scaling
- **Resource Optimization**: Shared database, connection pooling, and memory usage

## Quick Start

### Local Development

```bash
# Start local environment
make dev-up

# Run all quality checks
make pre-push

# Deploy consolidated API Gateway locally
make deploy-all
```

### Staging Deployment

Staging deployments happen automatically when PRs are merged to `main`:

```bash
# Manual staging deployment
make deploy-staging
```

### Production Deployment

Production uses a controlled canary deployment process:

```bash
# Trigger production canary (5% traffic)
make deploy-prod

# Monitor canary status
make canary-deploy

# Promote canary to full production
gh workflow run deploy.yml --field promote_canary=true
```

## Detailed Workflows

### 1. PR Validation Pipeline

**Trigger**: Pull request to `main`  
**File**: `.github/workflows/pr.yml`

#### Pipeline Stages

1. **Pre-flight Checks** (2 min)
   - Code formatting (`cargo fmt`)
   - Linting (`cargo clippy`)
   - Dependency vulnerability scan (`cargo audit`)

2. **Parallel Build & Test** (8 min)
   - **Backend Build**: Consolidated API Gateway compilation (includes all services)
   - **Frontend Build**: Next.js TypeScript compilation
   - **Unit Tests**: Fast isolated component tests (all services)
   - **Integration Tests**: Database + consolidated service integration

3. **Quality Gates** (5 min)
   - **Test Coverage**: ≥85% backend, ≥80% frontend
   - **Contract Tests**: OpenAPI specification compliance
   - **Security Scan**: Dependency vulnerabilities

4. **Approval Gate**
   - Manual approval required for external contributors
   - Auto-merge for internal team with passing checks

#### Commands

```bash
# Run locally before pushing
make check-pr

# Pre-push validation
make pre-push
```

### 2. Staging Deployment

**Trigger**: Merge to `main` branch  
**File**: `.github/workflows/main.yml`

#### Pipeline Stages

1. **Change Detection** (1 min)
   - Backend changes: `services/**, libs/**, Cargo.*`
   - Frontend changes: `apps/web/**`

2. **Artifact Build** (10 min)
   - **Backend**: Single consolidated API Gateway release build (contains all services)
   - **Frontend**: Production Next.js build
   - **SBOM Generation**: Security bill of materials for consolidated binary

3. **Staging Deploy** (8 min)
   - **Backend**: Single Shuttle deployment `salunga-ai-staging` (contains all services)
   - **Frontend**: Vercel staging environment
   - **Database**: Automatic migration execution for all services using single database

4. **Regression Testing** (15 min)
   - **Smoke Tests**: Critical path verification through unified API
   - **API Tests**: Health check + readiness validation for all service endpoints
   - **Performance**: Response time benchmarking (<2s) for consolidated API

5. **Production Gate**
   - Creates deployment request for manual approval
   - Notifies team via GitHub deployment status

#### Commands

```bash
# Manual staging deployment
make deploy-staging

# Check service health
make health-check
```

### 3. Production Canary Deployment

**Trigger**: Manual approval of staging deployment  
**File**: `.github/workflows/deploy.yml`

#### Canary Strategy

```
Phase 1: 5% traffic  → 30min soak → Metrics validation
Phase 2: 25% traffic → 20min soak → Metrics validation
Phase 3: 50% traffic → 15min soak → Metrics validation
Phase 4: 100% traffic → Deployment complete
```

#### Pipeline Stages

1. **Pre-deployment** (3 min)
   - Feature flag validation
   - Infrastructure health checks
   - Blue/green environment preparation

2. **Canary Deployment** (5 min)
   - Deploy consolidated API Gateway to canary infrastructure (`salunga-ai-canary`)
   - Configure traffic routing (5% initial) for all services through gateway
   - Enable monitoring and alerting for unified API

3. **Soak Testing** (30 min)
   - **Error Rate**: <0.1% (4xx/5xx responses)
   - **Latency**: P95 <500ms, P99 <1s
   - **Throughput**: Baseline ±10%
   - **Feature Flags**: Progressive rollout validation

4. **Progressive Rollout**
   - **Manual Gates**: Require approval between phases
   - **Automatic Rollback**: Triggered by metric violations
   - **Kill Switch**: Emergency feature flag disable

5. **Full Production** (2 min)
   - 100% traffic routing to consolidated API Gateway
   - Blue/green switchover for unified deployment
   - Legacy environment cleanup

#### Commands

```bash
# Trigger canary deployment
make deploy-prod

# Monitor canary status
make canary-deploy

# Promote canary manually
gh workflow run deploy.yml --field promote_canary=true

# Emergency rollback
make rollback
```

### 4. Emergency Rollback

**Trigger**: Manual or automated metric violations  
**File**: `.github/workflows/rollback.yml`

#### Rollback Targets

- **Canary**: Abort canary deployment, route to stable
- **Staging**: Revert to previous staging deployment
- **Production**: Full production rollback to last known good

#### Pipeline Stages

1. **Immediate Response** (30 sec)
   - Traffic routing to stable version
   - Feature flag emergency disable
   - Alert escalation to on-call

2. **System Recovery** (2 min)
   - Database rollback (if needed)
   - Service health validation
   - Cache invalidation

3. **Post-Rollback** (5 min)
   - Incident issue creation
   - Deployment status updates
   - Team notification

#### Commands

```bash
# Emergency rollback options
make rollback

# Specific rollback targets
gh workflow run rollback.yml --field target=production
gh workflow run rollback.yml --field target=canary
gh workflow run rollback.yml --field target=staging
```

## Feature Flag Integration

### Development Flags

Set environment variables for local development:

```bash
export FEATURE_FLAG_ENABLE_AI_FEATURES=true
export FEATURE_FLAG_ENABLE_CONTEXT_ORCHESTRATOR=false
export FEATURE_FLAG_ENABLE_DEBUG_LOGGING=true
export FEATURE_FLAG_CONSOLIDATED_SERVICES=true
```

### Production Flags

Managed via LaunchDarkly dashboard:

- **enable_ai_features**: AI-powered user stories and prompts
- **enable_context_orchestrator**: Advanced context routing
- **enable_canary_rollout**: Progressive deployment percentages
- **enable_debug_logging**: Detailed observability (staging only)

### Usage in Code

```rust
use common::feature_flags::FeatureFlagClient;

let flags = FeatureFlagClient::new().with_user_context(user);

if flags.is_enabled("enable_ai_features").await {
    // AI-powered feature logic
}

// Emergency kill switch
flags.emergency_disable("problematic_feature").await?;
```

### Commands

```bash
# View feature flag documentation
make feature-flags

# Local development flags (via .env)
echo "FEATURE_FLAG_ENABLE_AI_FEATURES=true" >> .env.local
```

## Quality Gates

### Test Coverage Requirements

- **Backend**: ≥85% line coverage
- **Frontend**: ≥80% line coverage
- **Integration**: ≥90% critical path coverage

### Performance SLAs

- **API Response Time**: P95 <500ms, P99 <1s
- **Page Load Time**: P95 <2s, P99 <3s
- **Error Rate**: <0.1% for 4xx/5xx responses
- **Uptime**: 99.9% availability target

### Security Requirements

- **Dependency Scanning**: No known critical vulnerabilities
- **Secret Scanning**: No hardcoded secrets in code
- **Authentication**: All endpoints except /health protected
- **HTTPS**: TLS 1.2+ required for all external traffic

### Commands

```bash
# Run quality gate locally
make quality-gate

# Generate coverage report
make coverage

# Security audit
cargo audit
```

## Monitoring & Observability

### Structured Logging

All services emit structured JSON logs with correlation IDs:

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "INFO",
  "request_id": "req_abc123",
  "service": "projects",
  "method": "POST",
  "path": "/projects",
  "duration_ms": 150,
  "status": 201
}
```

### Health Check Endpoints

The consolidated API Gateway exposes health endpoints for all services:

- **`/health`**: Simple liveness check for API Gateway
- **`/ready`**: Readiness including all service dependencies
- **`/metrics`**: Prometheus-compatible metrics for all services
- **Service-specific health checks**:
  - `/api/v1/projects/health`
  - `/api/v1/backlog/health`
  - `/api/v1/readiness/health`
  - `/api/v1/prompt-builder/health`
  - `/api/v1/context-orchestrator/health`

### Deployment Metrics

Automatically tracked during deployments:

- **Deployment Frequency**: Daily deployment cadence
- **Lead Time**: Commit to production time
- **MTTR**: Mean time to recovery from incidents
- **Change Failure Rate**: % of deployments requiring rollback

### Commands

```bash
# Check service health
make health-check

# View deployment metrics
gh run list --workflow=deploy.yml --json status,conclusion,createdAt
```

## Troubleshooting

### Common Issues

#### 1. PR Validation Failures

```bash
# Format issues
cargo fmt --all

# Linting errors
cargo clippy --all-targets --all-features -- -D warnings

# Test failures
cargo test --workspace

# Coverage below threshold
make coverage
```

#### 2. Staging Deployment Failures

```bash
# Check consolidated API Gateway status
cargo shuttle project status --name salunga-ai-staging

# View deployment logs
gh run view --log

# Manual staging retry
make deploy-staging
```

#### 3. Canary Deployment Issues

```bash
# Check canary metrics
make canary-deploy

# Emergency rollback
gh workflow run rollback.yml --field target=canary

# View canary logs
gh run view --workflow=deploy.yml --log
```

#### 4. Production Incidents

```bash
# Immediate rollback
make rollback

# Check system health
make health-check

# Disable problematic features
# (via LaunchDarkly dashboard)
```

### Debug Commands

```bash
# View recent deployments
gh deployment list

# Check workflow runs
gh run list --limit 10

# View consolidated API Gateway logs (local)
docker-compose logs -f api-gateway

# Database connectivity
make reset-db
```

## Security Considerations

### Secrets Management

- **Development**: `.env` files (gitignored)
- **Staging**: GitHub environment secrets
- **Production**: GitHub environment secrets + Vault

### Access Control

- **Repository**: Branch protection + required reviews
- **Deployments**: Manual approval gates
- **Infrastructure**: Service-specific deployment keys

### Vulnerability Management

- **Automated Scanning**: `cargo audit` in CI pipeline
- **Dependency Updates**: Renovate bot for security patches
- **Runtime Protection**: Shuttle sandboxing + TLS

## Support & Escalation

### Team Contacts

- **DevOps**: @devops-team (infrastructure, CI/CD)
- **QA**: @qa-team (testing, quality gates)
- **Architecture**: @arch-team (system design, ADRs)
- **On-Call**: PagerDuty escalation for production incidents

### Documentation

- **Architecture Decisions**: `docs/adr/`
- **API Specifications**: `services/*/docs/openapi.yaml`
- **Living Architecture**: `docs/adr/LIVING_ARCHITECTURE.md`

### External Resources

- **Shuttle Documentation**: https://docs.shuttle.rs/
- **GitHub Actions**: https://docs.github.com/en/actions
- **LaunchDarkly**: https://docs.launchdarkly.com/
