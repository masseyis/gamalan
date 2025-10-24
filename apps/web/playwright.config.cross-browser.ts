import { defineConfig, devices } from '@playwright/test'

/**
 * Cross-browser configuration for comprehensive testing
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.cross-browser.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['html', { outputFolder: 'test-results/cross-browser-report' }],
    ['json', { outputFile: 'test-results/cross-browser-results.json' }],
    ['junit', { outputFile: 'test-results/cross-browser-junit.xml' }],
  ],
  globalTimeout: 30 * 60 * 1000, // 30 minutes for cross-browser suite
  timeout: 60 * 1000, // 60 seconds per test

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 30 * 1000,
    navigationTimeout: 60 * 1000,
  },

  projects: [
    // Setup project
    {
      name: 'global setup',
      testMatch: /global\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // Desktop browsers
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/playwright/.clerk/user.json',
      },
      dependencies: ['global setup'],
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'tests/playwright/.clerk/user.json',
      },
      dependencies: ['global setup'],
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: 'tests/playwright/.clerk/user.json',
      },
      dependencies: ['global setup'],
    },

    // Mobile browsers
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: 'tests/playwright/.clerk/user.json',
      },
      dependencies: ['global setup'],
    },
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 12'],
        storageState: 'tests/playwright/.clerk/user.json',
      },
      dependencies: ['global setup'],
    },

    // Tablet
    {
      name: 'tablet',
      use: {
        ...devices['iPad Pro'],
        storageState: 'tests/playwright/.clerk/user.json',
      },
      dependencies: ['global setup'],
    },

    // High DPI displays
    {
      name: 'high-dpi',
      use: {
        ...devices['Desktop Chrome HiDPI'],
        storageState: 'tests/playwright/.clerk/user.json',
      },
      dependencies: ['global setup'],
    },
  ],

  webServer: {
    command: 'NODE_ENV=test pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 300 * 1000,
    stderr: 'pipe',
    stdout: 'pipe',
    env: {
      ...process.env,
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
        'pk_test_Y2xlcmtfdGVzdF9wdWJsaXNoYWJsZV9rZXkxMjM0NTY3ODkwYWJjZGVm',
      CLERK_PUBLISHABLE_KEY: 'pk_test_Y2xlcmtfdGVzdF9wdWJsaXNoYWJsZV9rZXkxMjM0NTY3ODkwYWJjZGVm',
      CLERK_SECRET_KEY: 'sk_test_Y2xlcmtfdGVzdF9zZWNyZXRfa2V5MTIzNDU2Nzg5MGFiY2RlZg==',
      E2E_CLERK_USER_USERNAME: 'test@example.com',
      E2E_CLERK_USER_PASSWORD: 'testpassword123',
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
