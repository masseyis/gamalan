# 🚀 Simple Setup Guide - Using Shuttle Managed Resources

This is the simplified setup using Shuttle's managed database (no external PostgreSQL needed!).

## ✅ Required Secrets (Minimal Setup)

### Step 1: Shuttle.rs (Backend)

1. Go to [shuttle.rs](https://shuttle.rs) → Sign up
2. Dashboard → API Keys → Generate new key
3. Add to GitHub secrets as: `SHUTTLE_API_KEY`

### Step 2: Vercel (Frontend)

1. Install Vercel CLI: `npm i -g vercel`
2. In `apps/web` directory: `vercel link`
3. Get token from [vercel.com/account/tokens](https://vercel.com/account/tokens)
4. Get project info: `vercel project ls`

Add to GitHub secrets:

```
VERCEL_TOKEN=your_token
VERCEL_ORG_ID=your_org_id
VERCEL_PROJECT_ID=your_project_id
```

## 🎯 Deploy Now!

That's it! You can now deploy with just these secrets:

```bash
# Deploy backend services (with managed databases)
gh workflow run shuttle-deploy.yml -f service=all

# Deploy frontend
gh workflow run vercel-deploy.yml
```

## 🔐 Add Authentication Later (Optional)

For full functionality, add Clerk secrets when ready:

1. Sign up at [clerk.com](https://clerk.com)
2. Create application → Get keys
3. Add these GitHub secrets:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx
CLERK_SECRET_KEY=sk_live_xxx
CLERK_WEBHOOK_SECRET=whsec_xxx
CLERK_JWKS_URL=https://your-domain.clerk.accounts.dev/.well-known/jwks.json
CLERK_JWT_ISSUER=https://your-domain.clerk.accounts.dev
CLERK_JWT_AUDIENCE=your-app-id
```

4. Set webhook URL to: `https://auth-gateway.shuttleapp.rs/webhooks/clerk`

## 📝 What You Get

- **5 Rust microservices** with isolated PostgreSQL databases
- **Automatic database migrations** on startup
- **Production-ready Next.js frontend**
- **Full CI/CD pipeline** with testing
- **Zero database management** required

## 🔗 Your URLs After Deployment

- Frontend: `https://your-project.vercel.app`
- Auth Gateway: `https://auth-gateway.shuttleapp.rs`
- Projects API: `https://projects.shuttleapp.rs`
- Backlog API: `https://backlog.shuttleapp.rs`
- Readiness API: `https://readiness.shuttleapp.rs`
- Prompt Builder API: `https://prompt-builder.shuttleapp.rs`

## 🆘 Troubleshooting

**Deployment failed?**

- Check GitHub Actions logs: `gh run list`
- Ensure secrets are properly set in GitHub repo settings
- Verify Shuttle API key is active

**Frontend can't connect to APIs?**

- Update frontend environment variables with actual Shuttle URLs
- Services deploy with predictable URLs: `https://SERVICE_NAME.shuttleapp.rs`
