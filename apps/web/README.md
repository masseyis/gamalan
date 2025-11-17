# Battra Web Application

A modern, AI-enhanced agile project management web application built with Next.js 15, TypeScript, and cutting-edge technologies.

## 🚀 Features

- **🔐 Authentication**: Secure user management with Clerk
- **📋 Project Management**: Create and manage agile projects
- **📝 Backlog Management**: Comprehensive story and task management
- **🎯 Sprint Board**: Drag-and-drop Kanban board for sprint management
- **🤖 AI-Powered Features**:
  - Story readiness assessment
  - Automatic acceptance criteria generation
  - Story breakdown suggestions
  - Task requirement clarification
- **📱 Responsive Design**: Mobile-first approach with Tailwind CSS
- **🎨 Modern UI**: Beautiful components with shadcn/ui
- **⚡ Performance**: Optimized with Next.js 15 and React 18
- **🧪 Testing**: Comprehensive unit and E2E tests

## 🛠 Tech Stack

### Frontend Framework

- **Next.js 15** - React framework with App Router
- **React 18** - UI library with concurrent features
- **TypeScript** - Type-safe JavaScript

### Styling & Components

- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Modern, accessible UI components
- **Radix UI** - Unstyled, accessible component primitives
- **Lucide React** - Beautiful & consistent icons

### State Management & Data Fetching

- **TanStack Query (React Query)** - Data fetching and caching
- **Zustand** - Lightweight state management

### Authentication

- **Clerk** - Complete authentication solution

### Form Handling & Validation

- **React Hook Form** - Performant forms with easy validation
- **Zod** - TypeScript-first schema validation

### Drag & Drop

- **@dnd-kit** - Modern drag and drop toolkit

### Testing

- **Vitest** - Fast unit test framework
- **Playwright** - Reliable end-to-end testing
- **Testing Library** - Simple and complete testing utilities
- **MSW** - API mocking for tests

### Development Tools

- **ESLint** - Code linting
- **Prettier** - Code formatting (via Next.js)
- **pnpm** - Fast, disk space efficient package manager

## 📁 Project Structure

```
apps/web/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth layout group
│   │   ├── sign-in/              # Sign-in page
│   │   └── sign-up/              # Sign-up page
│   ├── projects/                 # Projects module
│   │   ├── [id]/                 # Dynamic project routes
│   │   │   ├── backlog/          # Backlog management
│   │   │   │   ├── [storyId]/    # Story details
│   │   │   │   └── new/          # Create story
│   │   │   ├── board/            # Sprint board
│   │   │   └── settings/         # Project settings
│   │   └── new/                  # Create project
│   ├── dashboard/                # Main dashboard
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Home page
├── components/                   # Reusable components
│   ├── ai/                       # AI-related components
│   │   └── ai-assistant.tsx      # AI assistant widget
│   └── ui/                       # Base UI components
├── hooks/                        # Custom React hooks
├── lib/                          # Utility libraries
│   ├── api/                      # API client and endpoints
│   │   ├── client.ts             # Base API client
│   │   ├── projects.ts           # Projects API
│   │   ├── backlog.ts            # Backlog API
│   │   └── ai.ts                 # AI API
│   ├── types/                    # TypeScript type definitions
│   └── utils.ts                  # Utility functions
├── __tests__/                    # Unit tests
├── tests/e2e/                    # End-to-end tests
├── src/                          # Test setup and utilities
└── public/                       # Static assets
```

## 🚦 Getting Started

### Prerequisites

- **Node.js 20+** - JavaScript runtime
- **pnpm 9+** - Package manager
- **Clerk Account** - For authentication

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd battra/apps/web
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Environment Setup**

   ```bash
   cp .env.example .env.local
   ```

4. **Configure environment variables**
   Edit `.env.local` with your values:

   ```env
   # Clerk Authentication
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   CLERK_SECRET_KEY=your_clerk_secret_key

   # API Endpoints
   NEXT_PUBLIC_PROJECTS_API_URL=http://localhost:8001
   NEXT_PUBLIC_BACKLOG_API_URL=http://localhost:8002
   NEXT_PUBLIC_READINESS_API_URL=http://localhost:8003
   NEXT_PUBLIC_PROMPT_BUILDER_API_URL=http://localhost:8004

   # Feature Flags
   NEXT_PUBLIC_ENABLE_AI_FEATURES=true
   NEXT_PUBLIC_ENABLE_MOCK_DATA=false
   ```

5. **Start the development server**

   ```bash
   pnpm dev
   ```

6. **Open your browser**
   Visit [http://localhost:3000](http://localhost:3000)

## 🧪 Testing

### Unit Tests

```bash
# Run tests in watch mode
pnpm test

# Run tests once
pnpm test:run

# Run tests with coverage
pnpm test:coverage

# Run tests with UI
pnpm test:ui
```

### End-to-End Tests

```bash
# Install Playwright browsers (first time only)
pnpm playwright:install

# Run E2E tests
pnpm test:e2e

# Run E2E tests with UI
pnpm test:e2e:ui

# Debug E2E tests
pnpm test:e2e:debug
```

### Type Checking

```bash
pnpm type-check
```

### Linting

```bash
pnpm lint
```

## 🏗 Building

### Development Build

```bash
pnpm build
```

### Production Build

```bash
pnpm build
pnpm start
```

## 📊 Architecture Overview

### Component Architecture

- **Atomic Design**: Components organized in logical groups
- **Composition Pattern**: Flexible, reusable component composition
- **Props Interface**: Strict TypeScript interfaces for all props

### State Management

- **Server State**: TanStack Query for API data
- **Client State**: Zustand for UI state
- **Form State**: React Hook Form for form management

### API Integration

- **Modular Clients**: Separate API clients for each service
- **Type Safety**: Full TypeScript coverage for API responses
- **Error Handling**: Consistent error handling across all endpoints
- **Authentication**: Automatic token management with Clerk

### Styling Strategy

- **Utility-First**: Tailwind CSS for rapid development
- **Component System**: shadcn/ui for consistent design
- **Custom Themes**: CSS variables for theming
- **Responsive Design**: Mobile-first responsive approach

## 🔧 Configuration

### Tailwind CSS

Configured with custom color palette, typography, and component styles. See `tailwind.config.ts`.

### Next.js

Optimized configuration with:

- App Router enabled
- TypeScript strict mode
- Custom middleware for authentication
- Optimized bundling and tree-shaking

### ESLint

Extended Next.js ESLint config with additional rules for accessibility and best practices.

## 🌍 Environment Variables

| Variable                             | Description                | Required | Default               |
| ------------------------------------ | -------------------------- | -------- | --------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`  | Clerk publishable key      | ✅       | -                     |
| `CLERK_SECRET_KEY`                   | Clerk secret key           | ✅       | -                     |
| `NEXT_PUBLIC_PROJECTS_API_URL`       | Projects service URL       | ✅       | http://localhost:8001 |
| `NEXT_PUBLIC_BACKLOG_API_URL`        | Backlog service URL        | ✅       | http://localhost:8002 |
| `NEXT_PUBLIC_READINESS_API_URL`      | Readiness service URL      | ✅       | http://localhost:8003 |
| `NEXT_PUBLIC_PROMPT_BUILDER_API_URL` | Prompt Builder service URL | ✅       | http://localhost:8004 |
| `NEXT_PUBLIC_ENABLE_AI_FEATURES`     | Enable AI features         | ❌       | true                  |
| `NEXT_PUBLIC_ENABLE_MOCK_DATA`       | Enable mock data           | ❌       | false                 |

## 📈 Performance

### Core Web Vitals

- **LCP**: < 2.5s (Large Contentful Paint)
- **FID**: < 100ms (First Input Delay)
- **CLS**: < 0.1 (Cumulative Layout Shift)

### Optimization Techniques

- **Code Splitting**: Automatic route-based code splitting
- **Image Optimization**: Next.js Image component
- **Font Optimization**: Next.js Font optimization
- **Bundle Analysis**: Built-in bundle analyzer

## 🔐 Security

### Authentication

- **JWT Tokens**: Secure token-based authentication
- **Route Protection**: Middleware-based route protection
- **Session Management**: Automatic session handling

### Data Protection

- **Input Validation**: Zod schema validation
- **XSS Protection**: Built-in React XSS protection
- **CSRF Protection**: Next.js built-in CSRF protection

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Other Platforms

The application can be deployed to any Node.js hosting platform:

- Netlify
- Railway
- Heroku
- AWS Amplify

### Docker

```dockerfile
# See Dockerfile in the project root
docker build -t battra-web .
docker run -p 3000:3000 battra-web
```

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit your changes**: `git commit -m 'Add amazing feature'`
4. **Push to the branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Development Guidelines

- Follow TypeScript strict mode
- Write tests for new features
- Use conventional commits
- Ensure all tests pass
- Update documentation

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

## 💬 Support

- **Documentation**: [docs/](../../docs/)
- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)

---

Built with ❤️ by the Battra team
