import { defineConfig, devices } from '@playwright/test'

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Run all E2E tests in the e2e directory (staging tests are in separate directory) */
  testMatch: '**/*.spec.ts',
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
    actionTimeout: 60 * 1000, // 60 seconds per action
    navigationTimeout: 120 * 1000, // 2 minutes for navigation
  },

  /* Configure projects for major browsers */
  projects: [
    // Global setup project for Clerk authentication
    {
      name: 'global setup',
      testMatch: /global\.setup\.ts/,
    },

    // Authenticated tests project - tests that start with an authenticated user
    {
      name: 'authenticated tests',
      testMatch: /.*authenticated\.spec\.ts|.*cross-browser\.spec\.ts|.*error-handling\.spec\.ts|.*performance-stress\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/playwright/.clerk/user.json',
      },
      dependencies: ['global setup'],
    },

    // Authentication flow tests project - tests that verify sign-in/sign-up flows
    {
      name: 'auth flow tests',
      testMatch: /.*auth\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
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
        /.*cross-browser\.spec\.ts/,
        /.*error-handling\.spec\.ts/,
        /.*performance-stress\.spec\.ts/,
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
    command: 'NODE_ENV=test pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 300 * 1000, // 5 minutes timeout for server startup in CI
    stderr: 'pipe',
    stdout: 'pipe',
    env: {
      ...process.env,
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_bWFqb3Itc25ha2UtNzkuY2xlcmsuYWNjb3VudHMuZGV2JA',
      CLERK_SECRET_KEY: 'sk_test_nEqFdsNLenuDU5zq2FV4Ni1DRzmOLzNnrFQjBs7Edx',
      E2E_CLERK_USER_USERNAME: 'dummy+clerk_test@mock.com',
      E2E_CLERK_USER_PASSWORD: 'punvyx-ceczIf-3remza',
      NEXT_PUBLIC_CLERK_SIGN_IN_URL: '/sign-in',
      NEXT_PUBLIC_CLERK_SIGN_UP_URL: '/sign-up',
      NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: '/dashboard',
      NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: '/dashboard',
      NEXT_PUBLIC_PROJECTS_API_URL: 'http://localhost:8001',
      NEXT_PUBLIC_BACKLOG_API_URL: 'http://localhost:8002',
      NEXT_PUBLIC_READINESS_API_URL: 'http://localhost:8003',
      NEXT_PUBLIC_PROMPT_BUILDER_API_URL: 'http://localhost:8004',
      NEXT_PUBLIC_ENABLE_AI_FEATURES: 'true',
    },
  },
})

