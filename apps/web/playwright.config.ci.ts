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

    /* Test timeout */
    actionTimeout: 15 * 1000, // 15 seconds per action
    navigationTimeout: 30 * 1000, // 30 seconds for navigation
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: false, // Always start fresh in CI
    timeout: 480 * 1000, // 8 minutes timeout for server startup (CI can be slow)
    stderr: 'pipe',
    stdout: 'pipe',
    env: {
      ...process.env,
      // Ensure E2E environment variables are passed to dev server
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || 'pk_test_bW9jay1rZXktZm9yLXRlc3RpbmctcHVycG9zZXMtb25seQ==',
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || 'sk_test_bW9jay1rZXktZm9yLXRlc3RpbmctcHVycG9zZXMtb25seQ==',
      NEXT_PUBLIC_ENABLE_MOCK_DATA: process.env.NEXT_PUBLIC_ENABLE_MOCK_DATA || 'true',
      NEXT_PUBLIC_ENABLE_MOCK_AUTH: process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH || 'true',
      NEXT_PUBLIC_PROJECTS_API_URL: process.env.NEXT_PUBLIC_PROJECTS_API_URL || 'http://localhost:8001',
      NEXT_PUBLIC_BACKLOG_API_URL: process.env.NEXT_PUBLIC_BACKLOG_API_URL || 'http://localhost:8002',
      NEXT_PUBLIC_READINESS_API_URL: process.env.NEXT_PUBLIC_READINESS_API_URL || 'http://localhost:8003',
      NEXT_PUBLIC_PROMPT_BUILDER_API_URL: process.env.NEXT_PUBLIC_PROMPT_BUILDER_API_URL || 'http://localhost:8004',
      NEXT_PUBLIC_ENABLE_AI_FEATURES: process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES || 'true',
    },
  },
});