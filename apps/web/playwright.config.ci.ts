import { defineConfig, devices } from '@playwright/test'

/**
 * CI-optimized configuration for GitHub Actions
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Exclude heavy tests that run separately */
  testIgnore: [
    '**/*.cross-browser.spec.ts',
    '**/performance-stress.spec.ts'
  ],
  fullyParallel: true,
  forbidOnly: true, // Always forbid test.only in CI
  retries: 2, // Retry failed tests twice
  workers: 2, // Limit workers in CI for stability
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['github'] // GitHub Actions annotations
  ],
  globalTimeout: 15 * 60 * 1000, // 15 minutes for entire test suite
  timeout: 45 * 1000, // 45 seconds per test

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15 * 1000, // 15 seconds per action
    navigationTimeout: 30 * 1000, // 30 seconds for navigation
  },

  expect: {
    // Increase timeout for assertions in CI
    timeout: 10 * 1000,
  },

  projects: [
    // Global setup project for Clerk authentication
    {
      name: 'global setup',
      testMatch: /global\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // Authenticated tests project
    {
      name: 'authenticated tests',
      testMatch: /.*authenticated\.spec\.ts|.*auth\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/playwright/.clerk/user.json',
      },
      dependencies: ['global setup'],
    },

    // Public/unauthenticated tests
    {
      name: 'public tests',
      testMatch: /.*public\.spec\.ts|.*basic-smoke\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // Core workflow tests
    {
      name: 'core workflows',
      testMatch: [
        '**/workflows/*.authenticated.spec.ts',
        '**/edge-cases/error-handling.spec.ts'
      ],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/playwright/.clerk/user.json',
      },
      dependencies: ['global setup'],
    },
  ],

  webServer: {
    command: 'NODE_ENV=test pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true, // Reuse server started by E2E script
    timeout: 300 * 1000, // 5 minutes timeout for server startup
    stderr: 'pipe',
    stdout: 'pipe',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: '3000',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || 'pk_test_Y2xlcmtfdGVzdF9wdWJsaXNoYWJsZV9rZXkxMjM0NTY3ODkwYWJjZGVm',
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || 'sk_test_Y2xlcmtfdGVzdF9zZWNyZXRfa2V5MTIzNDU2Nzg5MGFiY2RlZg==',
      E2E_CLERK_USER_USERNAME: process.env.E2E_CLERK_USER_USERNAME || 'test@example.com',
      E2E_CLERK_USER_PASSWORD: process.env.E2E_CLERK_USER_PASSWORD || 'testpassword123',
      NEXT_PUBLIC_ENABLE_MOCK_AUTH: 'true',
      NEXT_PUBLIC_ENABLE_MOCK_DATA: 'true',
      NEXT_PUBLIC_PROJECTS_API_URL: 'http://localhost:8001',
      NEXT_PUBLIC_BACKLOG_API_URL: 'http://localhost:8002',
      NEXT_PUBLIC_READINESS_API_URL: 'http://localhost:8003',
      NEXT_PUBLIC_PROMPT_BUILDER_API_URL: 'http://localhost:8004',
      NEXT_PUBLIC_ENABLE_AI_FEATURES: 'true',
    },
  },
})