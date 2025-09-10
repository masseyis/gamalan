import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for staging environment testing
 * Optimized for comprehensive authentication testing and quality gates
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Run working staging tests */
  testMatch: ['**/staging-working.spec.ts'],
  
  /* Test execution strategy */
  fullyParallel: false, // Sequential execution for auth state management
  forbidOnly: !!process.env.CI, // Fail CI if test.only is left in code
  
  /* Retry configuration for staging environment stability */
  retries: process.env.CI ? 2 : 0, // Reduced retries to avoid auth conflicts
  workers: 1, // Single worker to avoid auth state conflicts
  
  /* Reporter configuration for quality gates */
  reporter: [
    ['html', { outputFolder: 'playwright-report/staging', open: 'never' }],
    ['json', { outputFile: 'test-results/staging-results.json' }],
    ['junit', { outputFile: 'test-results/staging-results.xml' }],
    ['list', { printSteps: true }], // Detailed console output for debugging
  ],
  
  /* Extended timeouts for staging environment */
  timeout: 90000, // 90s for complex auth flows
  expect: {
    timeout: 20000, // 20s for element expectations
  },
  
  /* Shared settings optimized for staging tests */
  use: {
    /* Base URL from environment variable */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || process.env.STAGING_BASE_URL,
    
    /* Enhanced debugging configuration */
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    /* Network and timing configuration */
    navigationTimeout: 45000, // Extended for auth redirects
    actionTimeout: 20000, // Extended for form interactions
    
    /* Browser context settings */
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: false, // Enforce HTTPS validation
    
    /* Enhanced error reporting - video configured at project level */
    
    /* User agent for staging identification */
    userAgent: 'Playwright-Staging-Tests/1.0',
    
    /* Extra HTTP headers for all requests */
    extraHTTPHeaders: {
      'X-Test-Environment': 'staging',
      'X-Test-Type': 'e2e-quality-gate'
    }
  },

  /* Browser projects optimized for quality gates */
  projects: [
    {
      name: 'desktop-chrome-staging',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        // Disable web security for staging domains if needed
        launchOptions: {
          args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
        }
      },
      testMatch: ['**/staging-*.spec.ts']
    },
    
    // Mobile testing for critical authentication flows
    {
      name: 'mobile-chrome-staging',
      use: { 
        ...devices['Pixel 5'],
        // Mobile-specific timeouts
        navigationTimeout: 60000,
        actionTimeout: 30000
      },
      testMatch: ['**/staging-auth.spec.ts'], // Only run auth tests on mobile
    },
    
    // Optional: Safari testing for auth compatibility
    {
      name: 'safari-staging',
      use: { 
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 720 }
      },
      testMatch: ['**/staging-auth.spec.ts'], // Focus on auth compatibility
    }
  ],

  /* Global setup and teardown */
  globalSetup: undefined, // No global setup needed for staging
  globalTeardown: undefined,

  /* Test output directories */
  outputDir: 'test-results/staging',
  
  /* No local dev server needed - testing remote staging */
  webServer: undefined,
});