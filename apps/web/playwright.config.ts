import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  /* Exclude staging tests from default runs (use staging config for those) */
  testIgnore: [
    '**/staging-*.spec.ts',
    '**/production-*.spec.ts',
    // Temporarily skip tests for unimplemented features
    '**/ai-features.spec.ts',
    '**/backlog-management.spec.ts',
    '**/story-detail.spec.ts',
    '**/sprint-board.spec.ts',
    '**/auth.spec.ts',
    '**/responsive-design.spec.ts',
    '**/navigation.spec.ts',
    '**/projects.spec.ts',
    '**/backlog.spec.ts',
    '**/brand/bran.spec.ts'
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
    {
      name: 'chromium',
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
  },
});