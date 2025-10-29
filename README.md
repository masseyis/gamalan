# Battra AI - AI-Enhanced Agile Project Management Platform

This is a monorepo for Battra AI, an AI-enhanced agile project management platform combining Rust microservices backend with a modern Next.js frontend.

## 🏗 Architecture

### Frontend

- **Next.js 15** web application (`apps/web/`)
- **React 18** with TypeScript
- **Tailwind CSS** + **shadcn/ui** components
- **TanStack Query** for data fetching
- **Clerk** for authentication

### Backend

- **Rust microservices** in `services/`
- **PostgreSQL** database
- **Shuttle** deployment platform

## Prerequisites

### Backend Development

- Rust 1.79+
- Docker and Docker Compose
- Shuttle CLI (`cargo install cargo-shuttle`)

### Frontend Development

- Node.js 20+
- pnpm 9+

## Local Development

1. **Start the database:**

   ```sh
   make dev-up
   ```

2. **Run migrations:**

   ```sh
   make migrate
   ```

3. **Set up environment variables:**

   Copy `.env.example` to `.env` and fill in the values.

   ```sh
   cp .env.example .env
   ```

   For the Next.js app, create `apps/web/.env.local` from the provided example and add your Clerk keys:

   ```sh
   cd apps/web
   cp .env.example .env.local
   ```

   At a minimum you need:

   ```env
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
   NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/assistant
   NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/assistant
   ```

   These values should match the Clerk dev instance that also backs the E2E credentials.

4. **Start backend services:**

   ```sh
   cargo run -p services/<service-name>
   ```

   To boot the consolidated API gateway with real Clerk verification run from `services/api-gateway/`:

   ```sh
   cargo shuttle run --secrets ../../Secrets.toml --port 8000
   ```

   The default `local_uri` in `services/api-gateway/src/main.rs` expects a PostgreSQL database at `postgres://postgres:password@localhost:5432/gamalan`. Update that connection or export `DATABASE_URL` if you use a different local database. The shared `Secrets.toml` already contains the Clerk JWKS settings for the dev tenant.

5. **Start the frontend:**

   ```sh
   cd apps/web
   cp .env.example .env.local  # Configure environment variables
   pnpm install
   pnpm dev
   ```

6. **Open your browser:**

   Visit [http://localhost:3000](http://localhost:3000)

## Testing

### Backend Testing

```sh
make test      # Run Rust tests
make coverage  # Generate coverage reports
```

### Frontend Testing

```sh
cd apps/web
pnpm test           # Unit tests
pnpm test:e2e       # End-to-end tests
pnpm test:coverage  # Coverage reports
```

## Deployment

### Initial Setup (One-time Bootstrap)

Before deploying for the first time, you need to create Shuttle projects and configure GitHub secrets:

1. **Install prerequisites:**

   ```sh
   # Install Shuttle CLI
   cargo install cargo-shuttle

   # Install jq for JSON processing
   brew install jq  # macOS
   # or apt-get install jq  # Ubuntu
   ```

2. **Log in to Shuttle:**

   ```sh
   shuttle login
   ```

3. **Run the bootstrap script:**

   ```sh
   ./scripts/bootstrap-shuttle-projects.sh
   ```

   This script will:
   - Create `salunga-ai-staging` and `salunga-ai-production` projects on Shuttle
   - Output the GitHub CLI commands to set the required secrets

4. **Set GitHub secrets:**
   Copy and run the `gh secret set` commands output by the bootstrap script.

### Automatic Deployment via GitHub Actions

After bootstrap, deployments are handled automatically:

- **Manual deployment:** Use the "Initial Deployment Bootstrap" workflow in GitHub Actions
- **Environment options:** staging or production
- **Optional frontend deployment:** Can be skipped if desired

### Manual Backend Services (Shuttle)

```sh
# Deploy a specific service manually
cd services/<service-name>
shuttle deploy --name salunga-ai-staging  # or salunga-ai-production
```

### Frontend (Vercel)

The frontend is automatically deployed to Vercel on push to main branch.

## 🤖 Autonomous Development

Battra AI includes autonomous agents that can plan sprints and implement tasks automatically:

### Quick Start: Fully Autonomous Development

1. **Start Scrum Master Agent** (plans and manages sprints):
   ```sh
   ./scripts/scrummaster-agent.sh battra-sm-key-1 <project-uuid>
   ```

2. **Start Dev Agents** (implement tasks):
   ```sh
   export GIT_WORKFLOW_ENABLED=true
   ./scripts/autonomous-agent.sh battra-dev-key-1 <sprint-uuid> dev
   ```

3. **Start QA Agents** (write tests):
   ```sh
   export GIT_WORKFLOW_ENABLED=true
   ./scripts/autonomous-agent.sh battra-qa-key-1 <sprint-uuid> qa
   ```

The agents will:
- ✅ Automatically plan sprints from ready stories
- ✅ Continuously pick and implement tasks
- ✅ Create branches and PRs for each task
- ✅ Run tests and wait for reviews
- ✅ Close sprints and plan new ones

For complete setup instructions, see:
- [Quick Start: Full Automation](docs/QUICK_START_FULL_AUTOMATION.md)
- [Scrum Master Agent](docs/SCRUMMASTER_AGENT.md)
- [Git Workflow for Agents](docs/GIT_WORKFLOW_FOR_AGENTS.md)

## 📁 Project Structure

```
salunga/
├── apps/
│   └── web/                 # Next.js frontend application
├── services/
│   ├── auth-gateway/        # Authentication and routing
│   ├── projects/           # Project management service
│   ├── backlog/            # Backlog and story management
│   ├── readiness/          # AI readiness assessment
│   └── prompt-builder/     # AI prompt generation
├── libs/
│   ├── common/             # Shared utilities and types
│   └── auth_clerk/         # Clerk authentication library
├── scripts/
│   ├── scrummaster-agent.sh     # Autonomous sprint management
│   ├── autonomous-agent.sh      # Autonomous task execution
│   ├── sprint-planner.js        # Sprint planning logic
│   └── claude-code-executor-with-git.js  # Task implementation with git workflow
└── docs/                   # Documentation
    ├── QUICK_START_FULL_AUTOMATION.md
    ├── SCRUMMASTER_AGENT.md
    └── GIT_WORKFLOW_FOR_AGENTS.md
```

For detailed information about each component:

- [Frontend Documentation](apps/web/README.md)
- [API Documentation](docs/api.md)
- [Contributing Guidelines](CONTRIBUTING.md)
- [Autonomous Development Guide](docs/QUICK_START_FULL_AUTOMATION.md)
