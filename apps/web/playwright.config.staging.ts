import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for staging environment testing
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Run only smoke tests for staging */
  testMatch: ['**/staging-smoke.spec.ts'],
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI for flaky network/deployment issues */
  retries: process.env.CI ? 3 : 0,
  /* Opt out of parallel tests on CI for staging stability */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use */
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/staging-results.json' }],
    ['junit', { outputFile: 'test-results/staging-results.xml' }]
  ],
  
  /* Global test timeout for staging (longer due to network latency) */
  timeout: 60000,
  /* Expect timeout for staging environment */
  expect: {
    timeout: 15000,
  },
  
  /* Shared settings for staging tests */
  use: {
    /* Base URL from environment variable */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || process.env.STAGING_BASE_URL,
    
    /* Collect trace on failure for debugging */
    trace: 'retain-on-failure',
    
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Video recording for debugging staging issues */
    video: 'retain-on-failure',
    
    /* Wait for network to be idle before proceeding */
    navigationTimeout: 30000,
    actionTimeout: 15000,
  },

  /* Configure projects for staging testing - focus on Chrome for speed */
  projects: [
    {
      name: 'chromium-staging',
      use: { 
        ...devices['Desktop Chrome'],
        // Additional staging-specific options
        viewport: { width: 1280, height: 720 },
      },
    },
    
    // Optional: Mobile testing for critical paths
    {
      name: 'mobile-staging',
      use: { 
        ...devices['Pixel 5'],
      },
    },
  ],

  /* No local dev server needed - testing remote staging */
  webServer: undefined,
});