# GitHub Actions Secrets Setup

This document outlines all required secrets for the CI/CD pipeline to function properly.

## Repository Secrets (Required)

Navigate to your GitHub repository → Settings → Secrets and variables → Actions

### Shuttle Deployment Secrets

```bash
# Shuttle API key for deployments
SHUTTLE_API_KEY=YOUR_SHUTTLE_API_KEY_HERE
```

### Clerk Authentication Secrets

```bash
# Clerk webhook signing secret for user management
CLERK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Clerk publishable key for frontend authentication
CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Clerk secret key for server-side authentication
CLERK_SECRET_KEY=sk_live_[YOUR_CLERK_SECRET_KEY]

# Clerk JWKS URL for JWT verification
CLERK_JWKS_URL=https://your-clerk-instance.clerk.accounts.dev/.well-known/jwks.json
```

### Database Connection Secrets

#### Production Database URLs

```bash
# Main services database URLs (production)
DATABASE_URL_PROJECTS=postgresql://user:pass@host:5432/salunga_projects_prod
DATABASE_URL_BACKLOG=postgresql://user:pass@host:5432/salunga_backlog_prod
DATABASE_URL_AUTH_GATEWAY=postgresql://user:pass@host:5432/salunga_auth_prod
DATABASE_URL_READINESS=postgresql://user:pass@host:5432/salunga_readiness_prod
DATABASE_URL_PROMPT_BUILDER=postgresql://user:pass@host:5432/salunga_prompt_builder_prod
```

#### Staging Database URLs

```bash
# Main services database URLs (staging)
DATABASE_URL_PROJECTS_STAGING=postgresql://user:pass@host:5432/salunga_projects_staging
DATABASE_URL_BACKLOG_STAGING=postgresql://user:pass@host:5432/salunga_backlog_staging
DATABASE_URL_AUTH_GATEWAY_STAGING=postgresql://user:pass@host:5432/salunga_auth_staging
DATABASE_URL_READINESS_STAGING=postgresql://user:pass@host:5432/salunga_readiness_staging
DATABASE_URL_PROMPT_BUILDER_STAGING=postgresql://user:pass@host:5432/salunga_prompt_builder_staging
```

### Vercel Deployment Secrets

```bash
# Vercel deployment token
VERCEL_TOKEN=YOUR_VERCEL_TOKEN_HERE

# Vercel organization ID (if using team/organization)
VERCEL_ORG_ID=YOUR_VERCEL_ORG_ID

# Vercel project ID for the web app
VERCEL_PROJECT_ID=YOUR_VERCEL_PROJECT_ID
```

### Additional Service Configuration

```bash
# OpenAI API key for prompt builder service
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# GitHub token for GitHub integrator service (when implemented)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Service-to-service communication secrets
SERVICE_API_KEY=your-internal-service-api-key-here
```

## Environment Variables (Per Environment)

### Environment-Specific Configuration

#### Production Environment Variables

```bash
ENVIRONMENT=production
LOG_LEVEL=info
RUST_LOG=info
API_BASE_URL=https://api.salunga.com
WEB_BASE_URL=https://app.salunga.com
```

#### Staging Environment Variables

```bash
ENVIRONMENT=staging
LOG_LEVEL=debug
RUST_LOG=debug
API_BASE_URL=https://api-staging.salunga.com
WEB_BASE_URL=https://staging.salunga.com
```

## Setup Commands

### 1. Set Repository Secrets via GitHub CLI

```bash
# Install GitHub CLI if not already installed
# brew install gh  # macOS
# Or download from https://cli.github.com/

# Login to GitHub CLI
gh auth login

# Set repository secrets (replace with actual values)
gh secret set SHUTTLE_API_KEY --body "YOUR_SHUTTLE_API_KEY_HERE"
gh secret set CLERK_WEBHOOK_SECRET --body "whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
gh secret set CLERK_PUBLISHABLE_KEY --body "pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
gh secret set CLERK_SECRET_KEY --body "sk_live_[YOUR_CLERK_SECRET_KEY]"
gh secret set CLERK_JWKS_URL --body "https://your-clerk-instance.clerk.accounts.dev/.well-known/jwks.json"

# Database URLs - Production
gh secret set DATABASE_URL_PROJECTS --body "postgresql://user:pass@host:5432/salunga_projects_prod"
gh secret set DATABASE_URL_BACKLOG --body "postgresql://user:pass@host:5432/salunga_backlog_prod"
gh secret set DATABASE_URL_AUTH_GATEWAY --body "postgresql://user:pass@host:5432/salunga_auth_prod"
gh secret set DATABASE_URL_READINESS --body "postgresql://user:pass@host:5432/salunga_readiness_prod"
gh secret set DATABASE_URL_PROMPT_BUILDER --body "postgresql://user:pass@host:5432/salunga_prompt_builder_prod"

# Database URLs - Staging
gh secret set DATABASE_URL_PROJECTS_STAGING --body "postgresql://user:pass@host:5432/salunga_projects_staging"
gh secret set DATABASE_URL_BACKLOG_STAGING --body "postgresql://user:pass@host:5432/salunga_backlog_staging"
gh secret set DATABASE_URL_AUTH_GATEWAY_STAGING --body "postgresql://user:pass@host:5432/salunga_auth_staging"
gh secret set DATABASE_URL_READINESS_STAGING --body "postgresql://user:pass@host:5432/salunga_readiness_staging"
gh secret set DATABASE_URL_PROMPT_BUILDER_STAGING --body "postgresql://user:pass@host:5432/salunga_prompt_builder_staging"

# Vercel secrets
gh secret set VERCEL_TOKEN --body "YOUR_VERCEL_TOKEN_HERE"
gh secret set VERCEL_ORG_ID --body "YOUR_VERCEL_ORG_ID"
gh secret set VERCEL_PROJECT_ID --body "YOUR_VERCEL_PROJECT_ID"

# Additional service secrets
gh secret set OPENAI_API_KEY --body "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
gh secret set GITHUB_TOKEN --body "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
gh secret set SERVICE_API_KEY --body "your-internal-service-api-key-here"
```

### 2. Verify Secrets Are Set

```bash
# List all secrets to verify they're properly configured
gh secret list
```

## Security Best Practices

1. **Rotation Schedule**: Rotate all secrets every 90 days
2. **Least Privilege**: Use service-specific database users with minimal required permissions
3. **Environment Separation**: Ensure staging and production secrets are completely separate
4. **Audit Trail**: All secret usage is logged in GitHub Actions runs
5. **Backup Recovery**: Store encrypted backup of secrets in secure location

## Secret Validation

Each service includes health checks that validate required secrets are present and functional:

- `/health` - Basic service health (no auth required)
- `/ready` - Readiness check including database connectivity and external service validation

## Troubleshooting

### Common Issues

1. **Database Connection Failures**: Verify DATABASE_URL format and network connectivity
2. **Clerk JWT Verification Failures**: Ensure CLERK_JWKS_URL is correct and accessible
3. **Shuttle Deployment Failures**: Verify SHUTTLE_API_KEY has correct permissions
4. **Vercel Deployment Failures**: Check VERCEL_TOKEN permissions and project configuration

### Debugging Commands

```bash
# Test database connectivity
psql "postgresql://user:pass@host:5432/dbname" -c "SELECT version();"

# Validate Clerk JWKS endpoint
curl -s "https://your-clerk-instance.clerk.accounts.dev/.well-known/jwks.json" | jq

# Test Shuttle CLI authentication
shuttle auth login
shuttle project list
```

## Migration from Development

When transitioning from development to production:

1. Update all database URLs from localhost to production endpoints
2. Replace Clerk development keys with production keys
3. Configure production domains in Clerk dashboard
4. Update API base URLs to production endpoints
5. Enable proper CORS policies for production domains
