import { defineConfig, devices } from '@playwright/test';

/**
 * CI-specific Playwright configuration
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Run all E2E tests with proper environment configuration */
  testMatch: '**/*.spec.ts',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI */
  retries: 2,
  /* Run tests serially in CI */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [['html'], ['github']],
  /* Global timeout for the entire test suite */
  globalTimeout: 12 * 60 * 1000, // 12 minutes max for all tests in CI

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'retain-on-failure',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Test timeout - increased from 30s to handle slow API responses */
    actionTimeout: 30 * 1000, // 30 seconds per action
    navigationTimeout: 45 * 1000, // 45 seconds for navigation
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Build and serve production build for E2E tests */
  webServer: {
    command: 'NODE_ENV=test NEXT_PUBLIC_ENABLE_MOCK_AUTH=true NEXT_PUBLIC_ENABLE_MOCK_DATA=true pnpm build && pnpm start',
    url: 'http://localhost:3000',
    reuseExistingServer: true, // Reuse server if already running
    timeout: 300 * 1000, // 5 minutes timeout for build + startup
    stderr: 'pipe',
    stdout: 'pipe',
    env: {
      ...process.env,
      // Set NODE_ENV to test to trigger test-specific layout
      NODE_ENV: 'test',
      // Enable mock authentication mode for E2E tests
      NEXT_PUBLIC_ENABLE_MOCK_AUTH: 'true',
      NEXT_PUBLIC_ENABLE_MOCK_DATA: 'true',
      NEXT_PUBLIC_ENABLE_AI_FEATURES: 'true',
      // Mock Clerk keys (not used when NEXT_PUBLIC_ENABLE_MOCK_AUTH=true, but required for AuthProviderWrapper fallback)
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || 'pk_test_valid_format_key_for_testing_purposes_only_not_real_key',
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || 'sk_test_valid_format_key_for_testing_purposes_only_not_real_key',
      // API endpoints for backend services
      NEXT_PUBLIC_PROJECTS_API_URL: process.env.NEXT_PUBLIC_PROJECTS_API_URL || 'http://localhost:8001',
      NEXT_PUBLIC_BACKLOG_API_URL: process.env.NEXT_PUBLIC_BACKLOG_API_URL || 'http://localhost:8002',
      NEXT_PUBLIC_READINESS_API_URL: process.env.NEXT_PUBLIC_READINESS_API_URL || 'http://localhost:8003',
      NEXT_PUBLIC_PROMPT_BUILDER_API_URL: process.env.NEXT_PUBLIC_PROMPT_BUILDER_API_URL || 'http://localhost:8004',
    },
  },
});