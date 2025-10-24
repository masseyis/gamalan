# Deployment Secrets Configuration Guide

This document outlines the complete secrets configuration required for the Salunga AI deployment pipeline.

## Overview

The deployment pipeline uses GitHub Secrets to securely manage sensitive configuration data across different environments. Secrets are environment-specific and follow a consistent naming convention.

## Required Secrets by Environment

### Production Secrets

#### Core Platform Secrets

| Secret Name                     | Description                   | Example Value           | Required |
| ------------------------------- | ----------------------------- | ----------------------- | -------- |
| `SHUTTLE_API_KEY`               | Shuttle.rs platform API key   | `shuttle_xxx_yyy`       | ✅       |
| `SHUTTLE_PROJECT_ID_PRODUCTION` | Production Shuttle project ID | `salunga-ai-production` | ✅       |

#### Authentication (Clerk)

| Secret Name                       | Description                  | Example Value                                                  | Required |
| --------------------------------- | ---------------------------- | -------------------------------------------------------------- | -------- |
| `PRODUCTION_CLERK_WEBHOOK_SECRET` | Clerk webhook signing secret | `whsec_xxx`                                                    | ✅       |
| `PRODUCTION_CLERK_JWKS_URL`       | Clerk JWKS endpoint URL      | `https://your-domain.clerk.accounts.dev/.well-known/jwks.json` | ✅       |
| `PRODUCTION_CLERK_JWT_ISSUER`     | JWT issuer identifier        | `https://your-domain.clerk.accounts.dev`                       | ✅       |
| `PRODUCTION_CLERK_JWT_AUDIENCE`   | JWT audience identifier      | `your-app-identifier`                                          | ✅       |

#### Frontend Deployment (Vercel)

| Secret Name         | Description             | Example Value | Required |
| ------------------- | ----------------------- | ------------- | -------- |
| `VERCEL_TOKEN`      | Vercel deployment token | `xxx_xxx_xxx` | ✅       |
| `VERCEL_ORG_ID`     | Vercel organization ID  | `team_xxx`    | ✅       |
| `VERCEL_PROJECT_ID` | Vercel project ID       | `prj_xxx`     | ✅       |

#### Service URLs

| Secret Name               | Description             | Example Value                               | Required |
| ------------------------- | ----------------------- | ------------------------------------------- | -------- |
| `PRODUCTION_API_URL`      | Production API base URL | `https://salunga-ai-production.shuttle.app` | ✅       |
| `PRODUCTION_FRONTEND_URL` | Production frontend URL | `https://your-app.vercel.app`               | ✅       |

### Staging Secrets

#### Core Platform Secrets

| Secret Name                  | Description                | Example Value        | Required |
| ---------------------------- | -------------------------- | -------------------- | -------- |
| `SHUTTLE_PROJECT_ID_STAGING` | Staging Shuttle project ID | `salunga-ai-staging` | ✅       |

#### Authentication (Clerk - Staging)

| Secret Name                    | Description                  | Example Value                                                     | Required |
| ------------------------------ | ---------------------------- | ----------------------------------------------------------------- | -------- |
| `STAGING_CLERK_WEBHOOK_SECRET` | Staging Clerk webhook secret | `whsec_xxx`                                                       | ✅       |
| `STAGING_CLERK_JWKS_URL`       | Staging Clerk JWKS endpoint  | `https://staging-domain.clerk.accounts.dev/.well-known/jwks.json` | ✅       |
| `STAGING_CLERK_JWT_ISSUER`     | Staging JWT issuer           | `https://staging-domain.clerk.accounts.dev`                       | ✅       |
| `STAGING_CLERK_JWT_AUDIENCE`   | Staging JWT audience         | `your-staging-app-identifier`                                     | ✅       |

#### Frontend (Clerk - Public Keys)

| Secret Name                     | Description                   | Example Value | Required |
| ------------------------------- | ----------------------------- | ------------- | -------- |
| `STAGING_CLERK_PUBLISHABLE_KEY` | Staging Clerk publishable key | `pk_test_xxx` | ✅       |
| `STAGING_CLERK_SECRET_KEY`      | Staging Clerk secret key      | `sk_test_xxx` | ✅       |

#### Service URLs

| Secret Name            | Description          | Example Value                            | Required |
| ---------------------- | -------------------- | ---------------------------------------- | -------- |
| `STAGING_API_BASE_URL` | Staging API base URL | `https://salunga-ai-staging.shuttle.app` | ✅       |
| `STAGING_BASE_URL`     | Staging frontend URL | `https://staging-your-app.vercel.app`    | ✅       |

### Optional/Monitoring Secrets

| Secret Name          | Description                   | Example Value                        | Required |
| -------------------- | ----------------------------- | ------------------------------------ | -------- |
| `MONITORING_API_URL` | Prometheus/monitoring API URL | `https://prometheus.your-domain.com` | ❌       |
| `CODECOV_TOKEN`      | Codecov upload token          | `xxx-xxx-xxx`                        | ❌       |
| `SLACK_WEBHOOK_URL`  | Slack notifications webhook   | `https://hooks.slack.com/xxx`        | ❌       |

## Secrets Configuration in GitHub

### Setting up Secrets

1. Navigate to your repository on GitHub
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret with its corresponding value

### Environment-Specific Secrets

Some secrets are configured as **Environment secrets** for additional security:

1. Go to **Settings** → **Environments**
2. Create environments: `production`, `staging`
3. Add environment-specific secrets to each environment

#### Production Environment Secrets

- All `PRODUCTION_*` secrets
- `VERCEL_*` secrets (if using separate production deployment)

#### Staging Environment Secrets

- All `STAGING_*` secrets

## Secrets Validation

The pipeline includes automatic secrets validation in the `secrets-management.yml` workflow:

```bash
# Run validation
gh workflow run secrets-management.yml --ref main
```

## Security Best Practices

### 1. Secret Rotation Schedule

| Secret Type      | Rotation Frequency | Owner         |
| ---------------- | ------------------ | ------------- |
| Shuttle API Keys | Every 90 days      | DevOps Team   |
| Clerk Secrets    | Every 60 days      | Backend Team  |
| Vercel Tokens    | Every 90 days      | Frontend Team |
| Webhook Secrets  | Every 30 days      | Backend Team  |

### 2. Access Control

- Limit repository access to essential team members
- Use environment protection rules for production
- Enable required reviews for production deployments
- Monitor secret access through audit logs

### 3. Secret Scanning

The pipeline automatically scans for:

- Hardcoded secrets in code
- Exposed API keys in logs
- Insecure secret patterns

## Troubleshooting

### Common Issues

#### 1. Authentication Failures

```
Error: Invalid Clerk webhook signature
```

**Solution:** Verify `CLERK_WEBHOOK_SECRET` matches Clerk dashboard

#### 2. Deployment Failures

```
Error: Project not found
```

**Solution:** Check `SHUTTLE_PROJECT_ID_*` values match Shuttle project names

#### 3. Frontend Build Issues

```
Error: Invalid environment configuration
```

**Solution:** Verify all `CLERK_*` and URL secrets are configured

### Validation Commands

```bash
# Test production API connectivity
curl -f $PRODUCTION_API_URL/health

# Test staging API connectivity
curl -f $STAGING_API_BASE_URL/health

# Validate Clerk JWKS endpoint
curl -f $PRODUCTION_CLERK_JWKS_URL

# Test webhook endpoint (requires valid payload)
curl -X POST $PRODUCTION_API_URL/webhooks/clerk \
  -H "Content-Type: application/json" \
  -H "svix-id: test" \
  -H "svix-timestamp: $(date +%s)" \
  -H "svix-signature: v1,test" \
  -d '{"type": "user.created", "data": {}}'
```

## Migration Guide

### From Individual Services to Consolidated API Gateway

If migrating from individual service deployments:

1. **Update Shuttle Project Names**
   - Old: `salunga-projects`, `salunga-backlog`, etc.
   - New: `salunga-ai-production`, `salunga-ai-staging`

2. **Update API URLs**
   - Old: Multiple service URLs
   - New: Single gateway URL with service paths

3. **Consolidate Secrets**
   - Remove individual service secrets
   - Keep only gateway-level secrets

### Environment Variable Migration

Update your `.env` files to match the new secret naming:

```bash
# Old format
PROJECTS_API_URL=...
BACKLOG_API_URL=...

# New format
NEXT_PUBLIC_API_BASE_URL=...
```

## Compliance & Auditing

### Required Documentation

- [ ] Secret inventory maintained
- [ ] Rotation schedule documented
- [ ] Access control matrix updated
- [ ] Incident response plan includes secret rotation
- [ ] Backup/recovery procedures include secret management

### Audit Trail

All secret-related activities are logged:

- Secret creation/updates (GitHub audit log)
- Secret access (workflow run logs)
- Rotation events (deployment logs)
- Validation failures (security scan results)

## Emergency Procedures

### Secret Compromise Response

1. **Immediate Actions**
   - Rotate compromised secret immediately
   - Update all deployment configurations
   - Run security scan workflow
   - Check access logs for unauthorized usage

2. **Notification**
   - Alert security team
   - Notify affected service owners
   - Document incident in security log

3. **Recovery**
   - Deploy updated configurations
   - Verify all services are operational
   - Monitor for any service disruptions
   - Update incident response documentation

### Emergency Contacts

- **DevOps Team**: Deploy new secrets
- **Security Team**: Incident response
- **Platform Teams**: Service-specific secret rotation

---

_This document should be reviewed and updated quarterly or after any significant infrastructure changes._
