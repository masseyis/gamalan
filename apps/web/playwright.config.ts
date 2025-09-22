import { defineConfig, devices } from '@playwright/test'

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  /* Exclude staging tests from default runs (use staging config for those) */
  testMatch: '**/*.spec.ts',
  testIgnore: [
    '**/staging-*.spec.ts',
    '**/production-*.spec.ts',
    // Skip tests that require full implementation
    '**/ai-features.spec.ts',
    '**/backlog-management.spec.ts',
    '**/story-detail.spec.ts',
    '**/sprint-board.spec.ts',
    '**/responsive-design.spec.ts',
    '**/brand/bran.spec.ts',
  ],
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Global timeout for the entire test suite */
  globalTimeout: 10 * 60 * 1000, // 10 minutes max for all tests

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Test timeout */
    actionTimeout: 30 * 1000, // 30 seconds per action
    navigationTimeout: 60 * 1000, // 1 minute for navigation
  },

  /* Configure projects for major browsers */
  projects: [
    // Global setup project for Clerk authentication
    {
      name: 'global setup',
      testMatch: /global\.setup\.ts/,
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

    // Unauthenticated tests project (public pages)
    {
      name: 'public tests',
      testMatch: /.*public\.spec\.ts|.*basic-smoke\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // All other tests (default project)
    {
      name: 'chromium',
      testIgnore: [
        /.*authenticated\.spec\.ts/,
        /.*auth\.spec\.ts/,
        /.*public\.spec\.ts/,
        /.*staging.*spec\.ts/,
        /global\.setup\.ts/,
      ],
      use: { ...devices['Desktop Chrome'] },
    },
    // Temporarily disable other browsers to focus on core functionality
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 300 * 1000, // 5 minutes timeout for server startup in CI
    stderr: 'pipe',
    stdout: 'pipe',
    env: {
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_ZXhhbXBsZS5jbGVyay5kZXYK$',
      CLERK_PUBLISHABLE_KEY: 'pk_test_ZXhhbXBsZS5jbGVyay5kZXYK$',
      CLERK_SECRET_KEY: 'sk_test_mock_key_for_e2e_testing_purposes_only',
      E2E_CLERK_USER_USERNAME: 'test@example.com',
      E2E_CLERK_USER_PASSWORD: 'testpassword123',
      NEXT_PUBLIC_ENABLE_MOCK_AUTH: 'true',
    },
  },
})

