# Deployment Guide

This document explains how to set up CI/CD and deployments for the Salunga project.

## Overview

The project uses a dual-deployment strategy:

- **Backend Services (Rust)**: Deployed to Shuttle.rs
- **Frontend (Next.js)**: Deployed to Vercel

## Required Secrets

### GitHub Repository Secrets

Add these secrets to your GitHub repository settings:

#### Shuttle.rs Deployment

```
SHUTTLE_API_KEY=your_shuttle_api_key_here
CLERK_WEBHOOK_SECRET=your_clerk_webhook_secret
CLERK_JWKS_URL=https://your-clerk-domain.clerk.accounts.dev/.well-known/jwks.json
CLERK_JWT_ISSUER=https://your-clerk-domain.clerk.accounts.dev
CLERK_JWT_AUDIENCE=your-application-id
```

**Note:** `DATABASE_URL` is NOT needed - Shuttle automatically provides managed PostgreSQL databases for each service.

#### Vercel Deployment

```
VERCEL_TOKEN=your_vercel_token
VERCEL_ORG_ID=your_vercel_org_id
VERCEL_PROJECT_ID=your_vercel_project_id
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxxx
CLERK_SECRET_KEY=sk_live_xxxxxxxxxx
NEXT_PUBLIC_PROJECTS_API_URL=https://your-projects-service.shuttleapp.rs
NEXT_PUBLIC_BACKLOG_API_URL=https://your-backlog-service.shuttleapp.rs
NEXT_PUBLIC_READINESS_API_URL=https://your-readiness-service.shuttleapp.rs
NEXT_PUBLIC_PROMPT_BUILDER_API_URL=https://your-prompt-builder-service.shuttleapp.rs
NEXT_PUBLIC_ENABLE_AI_FEATURES=true
NEXT_PUBLIC_ENABLE_MOCK_DATA=false
```

## Setup Instructions

### 1. Shuttle.rs Setup

1. Create an account at [shuttle.rs](https://shuttle.rs)
2. Generate an API key from your dashboard
3. Add the API key as `SHUTTLE_API_KEY` in GitHub secrets

### 2. Vercel Setup

1. Create an account at [vercel.com](https://vercel.com)
2. Install the Vercel CLI: `npm i -g vercel`
3. Login and link your project: `vercel link`
4. Get your organization and project IDs:
   ```bash
   vercel project ls
   ```
5. Create a Vercel token from your account settings
6. Add all Vercel secrets to GitHub

### 3. Clerk Setup

1. Create a Clerk application at [clerk.com](https://clerk.com)
2. Get your publishable key and secret key
3. Configure webhook endpoints in Clerk dashboard:
   - `https://your-auth-gateway.shuttleapp.rs/webhooks/clerk`
4. Set up JWT settings and get JWKS URL
5. Add all Clerk secrets to GitHub

### 4. Database Setup

**No setup required!** 🎉

Shuttle automatically provides managed PostgreSQL databases for each service. The databases are:

- Created automatically on first deployment
- Isolated per service for security
- Migrations run automatically on startup
- Connection strings are injected automatically

Each service gets its own database instance, so you don't need to manage any database setup.

## Workflows

### CI/CD Pipelines

1. **Frontend CI** (`.github/workflows/frontend-ci.yml`)
   - Runs on changes to `apps/web/**`
   - Lints, tests, and builds the Next.js application
   - Runs Playwright E2E tests

2. **Backend CI** (`.github/workflows/ci.yml`)
   - Runs on changes to Rust code
   - Runs rustfmt, clippy, builds, and tests
   - Generates code coverage

3. **Shuttle Deploy** (`.github/workflows/shuttle-deploy.yml`)
   - Deploys Rust services to Shuttle.rs
   - Runs on main branch changes to backend code
   - Can be triggered manually for specific services

4. **Vercel Deploy** (`.github/workflows/vercel-deploy.yml`)
   - Deploys frontend to Vercel
   - Runs on main branch changes to frontend code
   - Automatic production deployments

### Manual Deployments

#### Deploy specific Shuttle service:

```bash
gh workflow run shuttle-deploy.yml -f service=backlog
```

#### Deploy frontend manually:

```bash
gh workflow run vercel-deploy.yml
```

## Service URLs

After deployment, your services will be available at:

- **Frontend**: `https://your-project.vercel.app`
- **Auth Gateway**: `https://auth-gateway.shuttleapp.rs`
- **Projects Service**: `https://projects.shuttleapp.rs`
- **Backlog Service**: `https://backlog.shuttleapp.rs`
- **Readiness Service**: `https://readiness.shuttleapp.rs`
- **Prompt Builder**: `https://prompt-builder.shuttleapp.rs`

## Environment Variables

### Development (.env.local for frontend)

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxxxx
NEXT_PUBLIC_PROJECTS_API_URL=http://localhost:8001
NEXT_PUBLIC_BACKLOG_API_URL=http://localhost:8002
NEXT_PUBLIC_READINESS_API_URL=http://localhost:8003
NEXT_PUBLIC_PROMPT_BUILDER_API_URL=http://localhost:8004
NEXT_PUBLIC_ENABLE_AI_FEATURES=true
NEXT_PUBLIC_ENABLE_MOCK_DATA=true
```

### Production

- All environment variables are set through GitHub secrets
- Services automatically pick up environment variables from Shuttle
- Frontend gets environment variables during Vercel build process

## Monitoring and Logs

- **Shuttle logs**: Access via Shuttle.rs dashboard or CLI
- **Vercel logs**: Access via Vercel dashboard
- **GitHub Actions**: Monitor deployments in Actions tab

## Troubleshooting

### Common Issues

1. **Shuttle deployment fails**: Check API key and service configuration
2. **Vercel build fails**: Verify environment variables and build settings
3. **Database connection issues**: Ensure DATABASE_URL is correct and accessible
4. **Clerk authentication issues**: Verify webhook secrets and JWT configuration

### Getting Help

- Check GitHub Actions logs for detailed error messages
- Review service logs in respective platform dashboards
- Ensure all required secrets are properly configured
