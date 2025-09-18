import { defineConfig, devices } from '@playwright/test';

/**
 * CI-specific Playwright configuration
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  /* Only run basic smoke tests in CI */
  testMatch: '**/basic-smoke.spec.ts',
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
  },
});