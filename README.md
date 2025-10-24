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
└── docs/                   # Documentation
```

For detailed information about each component:

- [Frontend Documentation](apps/web/README.md)
- [API Documentation](docs/api.md)
- [Contributing Guidelines](CONTRIBUTING.md)
