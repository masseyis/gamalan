# Salunga - AI-Enhanced Agile Project Management Platform

This is a monorepo for Salunga, an AI-enhanced agile project management platform combining Rust microservices backend with a modern Next.js frontend.

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

4. **Start backend services:**

   ```sh
   cargo run -p services/<service-name>
   ```

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

### Backend Services (Shuttle)
```sh
# Deploy a specific service
cd services/<service-name>
shuttle deploy
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
