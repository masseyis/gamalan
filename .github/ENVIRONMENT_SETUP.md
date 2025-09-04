# Environment Setup Documentation

This document provides comprehensive instructions for setting up staging and production environments for the Salunga AI Agile platform.

## Overview

The platform consists of:
- **Backend Services**: 7 Rust microservices deployed on Shuttle
- **Frontend**: Next.js application deployed on Vercel  
- **Database**: PostgreSQL instances for each service
- **Authentication**: Clerk for user authentication and authorization

## Environment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          PRODUCTION                             │
├─────────────────────────────────────────────────────────────────┤
│ Frontend: https://app.salunga.com (Vercel)                     │
│ API Gateway: https://api.salunga.com (Shuttle)                 │
│ Services: api-gateway-production.shuttleapp.rs                 │
│ Database: Separate PG instances per service                    │
│ Auth: Clerk Production Instance                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                          STAGING                                │
├─────────────────────────────────────────────────────────────────┤
│ Frontend: https://staging.salunga.com (Vercel)                 │
│ API Gateway: https://api-staging.salunga.com (Shuttle)         │
│ Services: api-gateway-staging.shuttleapp.rs                    │
│ Database: Separate staging PG instances                        │
│ Auth: Clerk Development Instance                                │
└─────────────────────────────────────────────────────────────────┘
```

## Service Configuration

### 1. Shuttle Services Configuration

Each service has environment-specific Shuttle configurations:

#### Production Services
- `api-gateway-production`
- `auth-gateway-production`
- `projects-production`
- `backlog-production` 
- `readiness-production`
- `prompt-builder-production`
- `context-orchestrator-production`

#### Staging Services
- `api-gateway-staging`
- `auth-gateway-staging`
- `projects-staging`
- `backlog-staging`
- `readiness-staging`
- `prompt-builder-staging`
- `context-orchestrator-staging`

### 2. Database Setup

Each service requires its own PostgreSQL database:

#### Production Databases
```sql
-- Execute on production PostgreSQL server
CREATE DATABASE salunga_projects_prod;
CREATE DATABASE salunga_backlog_prod;
CREATE DATABASE salunga_auth_prod;
CREATE DATABASE salunga_readiness_prod;
CREATE DATABASE salunga_prompt_builder_prod;
CREATE DATABASE salunga_context_orchestrator_prod;

-- Create service user with appropriate permissions
CREATE USER salunga_service WITH PASSWORD 'secure_production_password';
GRANT ALL PRIVILEGES ON DATABASE salunga_projects_prod TO salunga_service;
GRANT ALL PRIVILEGES ON DATABASE salunga_backlog_prod TO salunga_service;
GRANT ALL PRIVILEGES ON DATABASE salunga_auth_prod TO salunga_service;
GRANT ALL PRIVILEGES ON DATABASE salunga_readiness_prod TO salunga_service;
GRANT ALL PRIVILEGES ON DATABASE salunga_prompt_builder_prod TO salunga_service;
GRANT ALL PRIVILEGES ON DATABASE salunga_context_orchestrator_prod TO salunga_service;

-- Enable required extensions
\c salunga_projects_prod;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Repeat for all databases...
```

#### Staging Databases
```sql
-- Execute on staging PostgreSQL server (can be same server with different databases)
CREATE DATABASE salunga_projects_staging;
CREATE DATABASE salunga_backlog_staging;
CREATE DATABASE salunga_auth_staging;
CREATE DATABASE salunga_readiness_staging;
CREATE DATABASE salunga_prompt_builder_staging;
CREATE DATABASE salunga_context_orchestrator_staging;

-- Create staging service user
CREATE USER salunga_service_staging WITH PASSWORD 'secure_staging_password';
-- Grant permissions...
```

### 3. Environment Variables Configuration

#### Production Environment Variables
```bash
# Service Configuration
ENVIRONMENT=production
LOG_LEVEL=info
RUST_LOG=info

# API URLs
API_BASE_URL=https://api.salunga.com
WEB_BASE_URL=https://app.salunga.com

# Database URLs (per service)
DATABASE_URL_PROJECTS=postgresql://salunga_service:secure_production_password@prod-db-host:5432/salunga_projects_prod
DATABASE_URL_BACKLOG=postgresql://salunga_service:secure_production_password@prod-db-host:5432/salunga_backlog_prod
DATABASE_URL_AUTH_GATEWAY=postgresql://salunga_service:secure_production_password@prod-db-host:5432/salunga_auth_prod
DATABASE_URL_READINESS=postgresql://salunga_service:secure_production_password@prod-db-host:5432/salunga_readiness_prod
DATABASE_URL_PROMPT_BUILDER=postgresql://salunga_service:secure_production_password@prod-db-host:5432/salunga_prompt_builder_prod
DATABASE_URL_CONTEXT_ORCHESTRATOR=postgresql://salunga_service:secure_production_password@prod-db-host:5432/salunga_context_orchestrator_prod

# Clerk Authentication (Production)
CLERK_WEBHOOK_SECRET=whsec_production_webhook_secret
CLERK_PUBLISHABLE_KEY=pk_live_production_publishable_key
CLERK_SECRET_KEY=sk_live_production_secret_key
CLERK_JWKS_URL=https://your-production-clerk.clerk.accounts.dev/.well-known/jwks.json

# External Service APIs
OPENAI_API_KEY=sk-production_openai_api_key
GITHUB_TOKEN=ghp_production_github_token
SERVICE_API_KEY=production_internal_service_key
```

#### Staging Environment Variables
```bash
# Service Configuration
ENVIRONMENT=staging
LOG_LEVEL=debug
RUST_LOG=debug

# API URLs
API_BASE_URL=https://api-staging.salunga.com
WEB_BASE_URL=https://staging.salunga.com

# Database URLs (per service)
DATABASE_URL_PROJECTS=postgresql://salunga_service_staging:secure_staging_password@staging-db-host:5432/salunga_projects_staging
DATABASE_URL_BACKLOG=postgresql://salunga_service_staging:secure_staging_password@staging-db-host:5432/salunga_backlog_staging
DATABASE_URL_AUTH_GATEWAY=postgresql://salunga_service_staging:secure_staging_password@staging-db-host:5432/salunga_auth_staging
DATABASE_URL_READINESS=postgresql://salunga_service_staging:secure_staging_password@staging-db-host:5432/salunga_readiness_staging
DATABASE_URL_PROMPT_BUILDER=postgresql://salunga_service_staging:secure_staging_password@staging-db-host:5432/salunga_prompt_builder_staging
DATABASE_URL_CONTEXT_ORCHESTRATOR=postgresql://salunga_service_staging:secure_staging_password@staging-db-host:5432/salunga_context_orchestrator_staging

# Clerk Authentication (Development)
CLERK_WEBHOOK_SECRET=whsec_development_webhook_secret
CLERK_PUBLISHABLE_KEY=pk_test_development_publishable_key
CLERK_SECRET_KEY=sk_test_development_secret_key
CLERK_JWKS_URL=https://your-development-clerk.clerk.accounts.dev/.well-known/jwks.json

# External Service APIs (Development/Testing)
OPENAI_API_KEY=sk-development_openai_api_key
GITHUB_TOKEN=ghp_development_github_token
SERVICE_API_KEY=staging_internal_service_key
```

## Deployment Configuration

### 1. GitHub Actions Environment Setup

#### Repository Secrets
Set these in GitHub repository → Settings → Secrets and variables → Actions:

```bash
# Shuttle Deployment
SHUTTLE_API_KEY=your_shuttle_api_key

# Database URLs (Production)
DATABASE_URL_PROJECTS=postgresql://salunga_service:password@host:5432/salunga_projects_prod
DATABASE_URL_BACKLOG=postgresql://salunga_service:password@host:5432/salunga_backlog_prod
DATABASE_URL_AUTH_GATEWAY=postgresql://salunga_service:password@host:5432/salunga_auth_prod
DATABASE_URL_READINESS=postgresql://salunga_service:password@host:5432/salunga_readiness_prod
DATABASE_URL_PROMPT_BUILDER=postgresql://salunga_service:password@host:5432/salunga_prompt_builder_prod
DATABASE_URL_CONTEXT_ORCHESTRATOR=postgresql://salunga_service:password@host:5432/salunga_context_orchestrator_prod

# Database URLs (Staging)
DATABASE_URL_PROJECTS_STAGING=postgresql://salunga_service_staging:password@host:5432/salunga_projects_staging
DATABASE_URL_BACKLOG_STAGING=postgresql://salunga_service_staging:password@host:5432/salunga_backlog_staging
DATABASE_URL_AUTH_GATEWAY_STAGING=postgresql://salunga_service_staging:password@host:5432/salunga_auth_staging
DATABASE_URL_READINESS_STAGING=postgresql://salunga_service_staging:password@host:5432/salunga_readiness_staging
DATABASE_URL_PROMPT_BUILDER_STAGING=postgresql://salunga_service_staging:password@host:5432/salunga_prompt_builder_staging
DATABASE_URL_CONTEXT_ORCHESTRATOR_STAGING=postgresql://salunga_service_staging:password@host:5432/salunga_context_orchestrator_staging

# Clerk Authentication
CLERK_WEBHOOK_SECRET=whsec_webhook_secret
CLERK_PUBLISHABLE_KEY=pk_live_or_test_key
CLERK_SECRET_KEY=sk_live_or_test_key
CLERK_JWKS_URL=https://your-clerk-instance.clerk.accounts.dev/.well-known/jwks.json

# Vercel Deployment
VERCEL_TOKEN=your_vercel_token
VERCEL_ORG_ID=your_vercel_org_id
VERCEL_PROJECT_ID=your_vercel_project_id

# External Services
OPENAI_API_KEY=sk-your_openai_api_key
GITHUB_TOKEN=ghp_your_github_token
SERVICE_API_KEY=your_internal_service_key
```

#### Environment-Specific GitHub Environments

Create GitHub environments with protection rules:

**Production Environment:**
- Requires manual approval for deployments
- Only main branch can deploy
- Requires all status checks to pass

**Staging Environment:**
- Automatic deployment on PR merge to main
- No manual approval required
- All status checks must pass

### 2. Vercel Environment Setup

#### Production Environment
```bash
# Domain: https://app.salunga.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_production_key
CLERK_SECRET_KEY=sk_live_production_key
NEXT_PUBLIC_API_BASE_URL=https://api.salunga.com
NEXT_PUBLIC_WEB_BASE_URL=https://app.salunga.com
NODE_ENV=production
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding
```

#### Staging Environment  
```bash
# Domain: https://staging.salunga.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_development_key
CLERK_SECRET_KEY=sk_test_development_key
NEXT_PUBLIC_API_BASE_URL=https://api-staging.salunga.com
NEXT_PUBLIC_WEB_BASE_URL=https://staging.salunga.com
NODE_ENV=development
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding
```

## Setup Procedures

### 1. Initial Environment Setup

```bash
# 1. Set up repository secrets
./scripts/setup-secrets.sh

# 2. Configure branch protection
./scripts/setup-branch-protection.sh

# 3. Set up Shuttle projects
./scripts/setup-shuttle-projects.sh

# 4. Configure Vercel project
./scripts/setup-vercel-project.sh

# 5. Run validation tests
./scripts/validate-setup.sh
```

### 2. Database Migration Process

#### Production Migration
```bash
# 1. Backup existing data
pg_dump -h prod-db-host -U salunga_service salunga_projects_prod > backup-projects-$(date +%Y%m%d).sql

# 2. Run migrations for each service
cd services/projects && sqlx migrate run --database-url $DATABASE_URL_PROJECTS
cd services/backlog && sqlx migrate run --database-url $DATABASE_URL_BACKLOG
cd services/auth-gateway && sqlx migrate run --database-url $DATABASE_URL_AUTH_GATEWAY
cd services/readiness && sqlx migrate run --database-url $DATABASE_URL_READINESS
cd services/prompt-builder && sqlx migrate run --database-url $DATABASE_URL_PROMPT_BUILDER
cd services/context-orchestrator && sqlx migrate run --database-url $DATABASE_URL_CONTEXT_ORCHESTRATOR

# 3. Verify migrations
./scripts/verify-db-schema.sh production
```

#### Staging Migration
```bash
# Run staging migrations (similar process with staging URLs)
./scripts/migrate-staging.sh
./scripts/verify-db-schema.sh staging
```

### 3. Service Deployment

#### Deploy All Services to Staging
```bash
# Deploy via GitHub Actions
gh workflow run deploy.yml --ref main -f environment=staging -f services=all

# Or deploy individually
shuttle deploy --name api-gateway-staging services/api-gateway
shuttle deploy --name auth-gateway-staging services/auth-gateway
shuttle deploy --name projects-staging services/projects
shuttle deploy --name backlog-staging services/backlog
shuttle deploy --name readiness-staging services/readiness
shuttle deploy --name prompt-builder-staging services/prompt-builder
shuttle deploy --name context-orchestrator-staging services/context-orchestrator
```

#### Deploy All Services to Production
```bash
# Deploy via GitHub Actions (requires approval)
gh workflow run deploy.yml --ref main -f environment=production -f services=all
```

## Health Checks and Monitoring

### Service Health Endpoints

Each service exposes health check endpoints:

```bash
# Health check (no dependencies)
curl https://api-gateway-production.shuttleapp.rs/health

# Readiness check (includes DB connectivity)
curl https://api-gateway-production.shuttleapp.rs/ready

# Service-specific health
curl https://projects-production.shuttleapp.rs/health
curl https://backlog-production.shuttleapp.rs/health
curl https://readiness-production.shuttleapp.rs/health
curl https://prompt-builder-production.shuttleapp.rs/health
curl https://context-orchestrator-production.shuttleapp.rs/health
curl https://auth-gateway-production.shuttleapp.rs/health
```

### Monitoring Setup

#### Application Metrics
- **Logs**: Structured logging via `tracing` and `serde_json`
- **Metrics**: Custom metrics per service
- **Tracing**: Request correlation IDs across service boundaries
- **Health**: `/health` and `/ready` endpoints for Kubernetes-style health checks

#### Infrastructure Monitoring
- **Database**: Connection pool metrics, query performance
- **Network**: Service-to-service communication latency
- **Resources**: Memory usage, CPU utilization per service

## Security Configuration

### 1. Network Security

#### CORS Configuration
```rust
// API Gateway CORS setup
let cors = CorsLayer::new()
    .allow_origin(
        [
            "https://app.salunga.com".parse().unwrap(),
            "https://staging.salunga.com".parse().unwrap(),
        ]
    )
    .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
    .allow_headers([AUTHORIZATION, CONTENT_TYPE]);
```

#### Service-to-Service Authentication
- **API Keys**: Internal service communication
- **JWT Validation**: Clerk JWT verification with proper key rotation
- **TLS**: All communications over HTTPS

### 2. Database Security

#### Connection Security
- **SSL Mode**: Require SSL for all database connections
- **User Permissions**: Least privilege access per service
- **Network**: Database servers on private networks only

#### Backup and Recovery
```bash
# Daily automated backups
0 2 * * * pg_dump -h prod-db-host -U salunga_service salunga_projects_prod | gzip > /backups/projects-$(date +%Y%m%d).sql.gz

# Point-in-time recovery setup
wal_level = replica
archive_mode = on
archive_command = 'cp %p /archive/%f'
```

## Troubleshooting

### Common Issues

#### 1. Service Deployment Failures
```bash
# Check Shuttle logs
shuttle logs --name api-gateway-production

# Verify environment variables
shuttle resource list --name api-gateway-production

# Check service status
curl https://api-gateway-production.shuttleapp.rs/health
```

#### 2. Database Connection Issues
```bash
# Test direct connection
psql "postgresql://salunga_service:password@prod-db-host:5432/salunga_projects_prod" -c "SELECT version();"

# Check connection pool status
curl https://projects-production.shuttleapp.rs/ready
```

#### 3. Authentication Issues
```bash
# Validate Clerk JWKS endpoint
curl -s "https://your-clerk-instance.clerk.accounts.dev/.well-known/jwks.json" | jq

# Test JWT validation
curl -H "Authorization: Bearer $JWT_TOKEN" https://api-gateway-production.shuttleapp.rs/ready
```

### Rollback Procedures

#### Service Rollback
```bash
# Rollback to previous deployment
shuttle deployment rollback --name api-gateway-production

# Or via GitHub Actions
gh workflow run rollback.yml --ref main -f environment=production -f service=api-gateway -f version=previous
```

#### Database Rollback
```bash
# Stop services
shuttle deployment stop --name projects-production

# Restore from backup
psql -h prod-db-host -U salunga_service salunga_projects_prod < backup-projects-20240101.sql

# Restart services
shuttle deployment start --name projects-production
```

## Maintenance Procedures

### 1. Regular Maintenance

#### Weekly Tasks
- Review service logs for errors
- Check database performance metrics
- Verify backup integrity
- Update dependencies (security patches)

#### Monthly Tasks
- Rotate API keys and secrets
- Review access logs
- Performance optimization review
- Capacity planning assessment

### 2. Scaling Procedures

#### Horizontal Scaling
```bash
# Scale Shuttle services (if supported)
shuttle scale --name api-gateway-production --instances 3

# Database read replicas
psql -h prod-db-host -U postgres -c "SELECT * FROM pg_create_physical_replication_slot('replica1', true);"
```

#### Performance Tuning
```sql
-- Database performance tuning
ALTER DATABASE salunga_projects_prod SET shared_preload_libraries = 'pg_stat_statements';
ALTER DATABASE salunga_projects_prod SET log_statement_stats = on;
```

This comprehensive environment setup ensures robust, secure, and maintainable staging and production environments for the Salunga AI Agile platform.