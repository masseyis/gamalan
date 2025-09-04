# CI/CD Pipeline Setup Guide

This guide provides step-by-step instructions for setting up the complete CI/CD pipeline for the Salunga AI Agile platform.

## Quick Start

```bash
# Run the master setup script
./scripts/master-setup.sh
```

The master setup script provides an interactive menu to configure all aspects of your CI/CD pipeline.

## Overview

The CI/CD pipeline includes:

- **Repository Configuration**: Branch protection rules, GitHub Actions workflows, secrets management
- **Deployment Infrastructure**: Shuttle projects for Rust services, Vercel project for Next.js frontend
- **Testing Infrastructure**: Docker Compose environment for integration tests
- **Validation**: Comprehensive scripts to verify all components are properly configured

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    GitHub Repository                    │
├─────────────────────────────────────────────────────────┤
│ • Branch Protection (main)                             │
│ • GitHub Actions Workflows                             │
│ • Repository Secrets                                   │
│ • Environment Protection Rules                         │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                  CI/CD Pipeline                         │
├─────────────────────────────────────────────────────────┤
│ • Code Quality Checks (fmt, clippy, tests)            │
│ • Integration Testing (Docker PostgreSQL)             │
│ • Security Scanning                                    │
│ • Coverage Reports (≥85%)                              │
└─────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌─────────────────────┐           ┌─────────────────────┐
│   Shuttle Deployment│           │  Vercel Deployment  │
├─────────────────────┤           ├─────────────────────┤
│ • 7 Rust Services   │           │ • Next.js Frontend  │
│ • Staging/Production│           │ • Staging/Production│
│ • Auto Deployment  │           │ • Auto Deployment   │
└─────────────────────┘           └─────────────────────┘
```

## Components

### 1. Repository Configuration

**Files Created:**
- `.github/SECRETS_SETUP.md` - Comprehensive secrets documentation
- `scripts/setup-branch-protection.sh` - Branch protection configuration

**What it does:**
- Sets up main branch protection requiring PR reviews and status checks
- Configures GitHub Actions secrets for all environments
- Creates environment protection rules for staging/production

### 2. Deployment Infrastructure

**Files Created:**
- `scripts/setup-shuttle-projects.sh` - Shuttle project setup
- `scripts/setup-vercel-project.sh` - Vercel project configuration
- `.github/ENVIRONMENT_SETUP.md` - Environment configuration guide

**What it does:**
- Creates Shuttle projects for all 7 Rust services (staging + production)
- Configures Vercel project for Next.js frontend
- Sets up environment-specific configuration

### 3. Testing Infrastructure

**Files Created:**
- `docker-compose.test.yml` - CI testing environment
- `scripts/init-test-db.sh` - Test database initialization

**What it does:**
- Provides isolated PostgreSQL instances for testing
- Creates separate test databases for each service
- Enables parallel test execution without conflicts

### 4. Validation

**Files Created:**
- `scripts/validate-setup.sh` - Comprehensive validation script
- `scripts/master-setup.sh` - Interactive setup orchestrator

**What it does:**
- Validates all GitHub Actions workflows and secrets
- Checks branch protection rules and environment configurations
- Verifies Docker, Rust toolchain, and CLI tools
- Tests database connectivity and service configurations

## Setup Instructions

### Prerequisites

Ensure you have the following installed:

```bash
# Required tools
git --version
curl --version
jq --version

# Development tools (for validation)
rustc --version  # Rust 1.79+
cargo --version
docker --version
docker-compose --version

# CLI tools (install if needed)
gh auth status    # GitHub CLI
shuttle auth status  # Shuttle CLI (optional)
vercel whoami    # Vercel CLI (optional)
```

### Option 1: Interactive Setup (Recommended)

Run the master setup script for guided configuration:

```bash
./scripts/master-setup.sh
```

This provides an interactive menu with options:
1. **Full Setup** - Complete pipeline configuration
2. **GitHub Configuration Only** - Secrets and branch protection
3. **Deployment Infrastructure Only** - Shuttle and Vercel setup
4. **Testing Infrastructure Only** - Docker environment
5. **Individual Component Setup** - Choose specific components
6. **Validation Only** - Verify existing setup

### Option 2: Manual Setup

Run individual scripts in order:

```bash
# 1. Set up GitHub repository secrets (follow guide)
cat .github/SECRETS_SETUP.md

# 2. Configure branch protection
./scripts/setup-branch-protection.sh

# 3. Set up Shuttle projects
./scripts/setup-shuttle-projects.sh

# 4. Configure Vercel project
./scripts/setup-vercel-project.sh

# 5. Validate complete setup
./scripts/validate-setup.sh
```

### Option 3: Automated Setup (CI/CD)

For automated environments, run the validation script to check setup:

```bash
# Check current setup status
./scripts/validate-setup.sh

# Returns exit code 0 if all checks pass, 1 if any critical checks fail
echo $?
```

## Configuration Details

### GitHub Actions Secrets

Set these secrets in your GitHub repository (Settings → Secrets and variables → Actions):

**Essential Secrets:**
```bash
SHUTTLE_API_KEY              # Shuttle deployment authentication
CLERK_WEBHOOK_SECRET         # Clerk webhook verification
CLERK_PUBLISHABLE_KEY        # Clerk frontend authentication
CLERK_SECRET_KEY            # Clerk backend authentication
DATABASE_URL_*              # PostgreSQL connection strings (per service)
VERCEL_TOKEN               # Vercel deployment authentication
VERCEL_PROJECT_ID          # Vercel project identifier
```

**Environment-Specific Secrets:**
- Production: `DATABASE_URL_PROJECTS`, `DATABASE_URL_BACKLOG`, etc.
- Staging: `DATABASE_URL_PROJECTS_STAGING`, `DATABASE_URL_BACKLOG_STAGING`, etc.

### Branch Protection Rules

Main branch protection includes:
- **Required status checks**: CI, Frontend CI, Contract Tests
- **Required reviews**: 1 approving review
- **Dismiss stale reviews**: Enabled
- **Require code owner reviews**: Enabled
- **Restrict force pushes**: Enabled
- **Require conversation resolution**: Enabled

### Service Configuration

**Shuttle Services (7 total):**
- `api-gateway-{staging|production}`
- `auth-gateway-{staging|production}`
- `projects-{staging|production}`
- `backlog-{staging|production}`
- `readiness-{staging|production}`
- `prompt-builder-{staging|production}`
- `context-orchestrator-{staging|production}`

**Vercel Project:**
- Production: `https://app.salunga.com`
- Staging: `https://staging.salunga.com`

## Deployment Workflow

### Typical Development Flow

1. **Create feature branch** from `main`
2. **Develop and test** locally using `docker-compose up`
3. **Create pull request** → triggers CI pipeline
4. **CI Pipeline runs**:
   - Code formatting (`cargo fmt`)
   - Linting (`cargo clippy`)
   - Unit tests (`cargo test`)
   - Integration tests (with test database)
   - Coverage check (≥85% required)
5. **PR Review** → requires 1 approval
6. **Merge to main** → triggers deployment pipeline
7. **Automatic deployment** to staging environment
8. **Manual promotion** to production (with approval)

### Emergency Rollback

```bash
# Rollback service via GitHub Actions
gh workflow run rollback.yml \
  --ref main \
  -f environment=production \
  -f service=api-gateway \
  -f version=previous

# Or via Shuttle CLI
shuttle deployment rollback --name api-gateway-production
```

## Monitoring and Validation

### Health Check Endpoints

Each service exposes standard health endpoints:

```bash
# Basic health (no dependencies)
curl https://api-gateway-production.shuttleapp.rs/health

# Readiness check (includes database connectivity)
curl https://api-gateway-production.shuttleapp.rs/ready
```

### Validation Commands

```bash
# Comprehensive setup validation
./scripts/validate-setup.sh

# Quick GitHub Actions check
gh workflow list

# Service status check
shuttle project list

# Test environment validation
docker-compose -f docker-compose.test.yml config
```

### Troubleshooting

**Common Issues:**

1. **Secret not found**: Ensure GitHub repository secrets are properly set
2. **Database connection failed**: Verify DATABASE_URL format and network access
3. **Shuttle deployment failed**: Check SHUTTLE_API_KEY permissions
4. **CI tests failing**: Run locally with `docker-compose -f docker-compose.test.yml up`

**Debug Commands:**

```bash
# Check GitHub CLI authentication
gh auth status

# Test database connectivity
docker-compose up -d postgres
psql "postgresql://postgres:password@localhost:5432/gamalan" -c "SELECT version();"

# Validate Shuttle authentication
shuttle auth status
shuttle project list

# Check Vercel project status
vercel whoami
vercel project list
```

## Security Considerations

### Secrets Management
- Never commit secrets to version control
- Use GitHub repository secrets for CI/CD
- Rotate secrets regularly (90-day schedule recommended)
- Use environment-specific secrets (staging vs production)

### Network Security
- All services communicate over HTTPS
- Database connections require SSL
- CORS properly configured for frontend/backend communication
- JWT validation with proper JWKS key rotation

### Access Control
- Branch protection enforces code review
- Environment protection rules for production deployments
- Least privilege access for service accounts
- Audit logging for all deployments

## Support and Maintenance

### Regular Maintenance Tasks

**Weekly:**
- Review service logs for errors
- Check deployment success rates
- Verify backup integrity

**Monthly:**
- Rotate API keys and secrets
- Review and update dependencies
- Performance optimization review
- Capacity planning assessment

### Getting Help

1. **Validation Issues**: Run `./scripts/validate-setup.sh` for detailed diagnostics
2. **Setup Problems**: Use `./scripts/master-setup.sh` for guided troubleshooting
3. **Service Issues**: Check service health endpoints and logs
4. **Documentation**: Refer to `.github/ENVIRONMENT_SETUP.md` for detailed configuration

### Contributing

When making changes to the CI/CD pipeline:

1. Update relevant scripts in `scripts/` directory
2. Test changes with validation script
3. Update documentation
4. Create pull request with CI/CD impact assessment

---

## Summary

This CI/CD pipeline provides:

✅ **Automated quality gates** - fmt, clippy, tests, coverage  
✅ **Secure deployment** - secrets management, environment protection  
✅ **Comprehensive testing** - unit, integration, contract tests  
✅ **Multi-environment support** - staging and production  
✅ **Easy maintenance** - validation scripts, health checks  
✅ **Security best practices** - least privilege, audit logging  

The pipeline is production-ready and follows industry best practices for CI/CD, security, and maintainability.