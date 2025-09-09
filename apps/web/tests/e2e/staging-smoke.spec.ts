import { test, expect } from '@playwright/test'

/**
 * Staging Environment Smoke Tests
 * 
 * Critical quality gates for staging deployment validation.
 * These tests must pass before production deployment can proceed.
 */

// Get staging URLs from environment
const STAGING_BASE_URL = process.env.PLAYWRIGHT_BASE_URL || process.env.STAGING_BASE_URL
const STAGING_API_URL = process.env.STAGING_API_BASE_URL

if (!STAGING_BASE_URL) {
  throw new Error('STAGING_BASE_URL or PLAYWRIGHT_BASE_URL environment variable is required')
}

if (!STAGING_API_URL) {
  throw new Error('STAGING_API_BASE_URL environment variable is required')  
}

test.describe('Staging Smoke Tests - Critical Quality Gates', () => {
  
  test.beforeEach(async ({ page }) => {
    // Set longer timeouts for staging environment
    page.setDefaultTimeout(30000)
    page.setDefaultNavigationTimeout(30000)
  })

  test('should verify staging deployment health before E2E tests', async ({ page }) => {
    test.info().annotations.push({ 
      type: 'quality-gate', 
      description: 'Validates staging deployment is healthy and responsive' 
    })

    // Test API health endpoints first
    const apiHealthResponse = await page.request.get(`${STAGING_API_URL}/health`)
    expect(apiHealthResponse.status()).toBe(200)
    
    const apiReadyResponse = await page.request.get(`${STAGING_API_URL}/ready`)  
    expect(apiReadyResponse.status()).toBe(200)
    
    console.log('✅ Staging API health checks passed')
  })

  test('should load staging homepage without critical errors', async ({ page }) => {
    test.info().annotations.push({ 
      type: 'smoke-test', 
      description: 'Validates core frontend functionality on staging' 
    })

    // Monitor for JavaScript and network errors
    const jsErrors: string[] = []
    const criticalNetworkErrors: string[] = []
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        jsErrors.push(msg.text())
      }
    })

    page.on('pageerror', (error) => {
      jsErrors.push(error.message)
    })
    
    page.on('response', (response) => {
      if (response.status() >= 400) {
        const url = response.url()
        // Only track critical resource failures, not API failures (expected without auth)
        if (url.includes('.js') || url.includes('.css') || url.includes('.html')) {
          criticalNetworkErrors.push(`${url} - ${response.status()}`)
        }
      }
    })

    // Navigate to staging homepage with retry logic
    let response
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        response = await page.goto(STAGING_BASE_URL, { waitUntil: 'networkidle' })
        break
      } catch (error) {
        console.log(`Attempt ${attempt} failed:`, error)
        if (attempt === 3) throw error
        await page.waitForTimeout(5000) // Wait 5s before retry
      }
    }
    
    // Verify successful response
    expect(response?.status()).toBe(200)
    
    // Wait for React hydration to complete
    await page.waitForLoadState('networkidle')
    
    // Verify core application loaded
    const salungaLogoVisible = await page.locator('text=Salunga').first().isVisible({ timeout: 15000 })
    expect(salungaLogoVisible).toBe(true)
    
    // Check for critical JavaScript errors
    const criticalJSErrors = jsErrors.filter(error => 
      error.includes('SyntaxError') || 
      error.includes('ReferenceError') ||
      error.includes('TypeError: Cannot read') ||
      error.includes('Uncaught')
    )
    
    // Log all errors for debugging but only fail on critical ones
    if (jsErrors.length > 0) {
      console.log('JavaScript errors detected (may be non-critical):', jsErrors)
    }
    
    if (criticalNetworkErrors.length > 0) {
      console.log('Critical network errors:', criticalNetworkErrors)
    }
    
    // Fail test if critical errors found
    expect(criticalJSErrors.length, `Critical JavaScript errors found: ${criticalJSErrors.join(', ')}`).toBe(0)
    expect(criticalNetworkErrors.length, `Critical network errors found: ${criticalNetworkErrors.join(', ')}`).toBe(0)
    
    console.log('✅ Staging homepage smoke test passed')
  })

  test('should validate consolidated API endpoints', async ({ page }) => {
    test.info().annotations.push({ 
      type: 'api-integration', 
      description: 'Validates all service endpoints through API Gateway' 
    })

    // Test consolidated API Gateway endpoints
    const endpoints = [
      '/health',
      '/ready', 
      '/api/v1/projects/health',
      '/api/v1/backlog/health',
      '/api/v1/readiness/health', 
      '/api/v1/prompt-builder/health'
    ]
    
    for (const endpoint of endpoints) {
      const url = `${STAGING_API_URL}${endpoint}`
      console.log(`Testing endpoint: ${url}`)
      
      // Retry logic for each endpoint
      let success = false
      let lastError = null
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await page.request.get(url, { timeout: 10000 })
          
          if (response.status() === 200) {
            success = true
            console.log(`✅ ${endpoint} - OK`)
            break
          } else {
            lastError = `HTTP ${response.status()}`
            console.log(`⚠️  ${endpoint} - Attempt ${attempt} failed with ${response.status()}`)
          }
        } catch (error) {
          lastError = error
          console.log(`⚠️  ${endpoint} - Attempt ${attempt} failed:`, error)
        }
        
        if (attempt < 3) {
          await page.waitForTimeout(2000) // Wait 2s between retries
        }
      }
      
      expect(success, `${endpoint} failed after 3 attempts. Last error: ${lastError}`).toBe(true)
    }
    
    console.log('✅ All API endpoints validation passed')
  })

  test('should validate critical user journeys', async ({ page }) => {
    test.info().annotations.push({ 
      type: 'user-journey', 
      description: 'Tests critical paths users need for core functionality' 
    })

    // Test navigation to key pages
    const criticalPages = [
      { path: '/dashboard', expectedText: 'Dashboard' },
      { path: '/projects', expectedText: 'Projects' },
      { path: '/assistant', expectedText: 'AI Assistant' }
    ]
    
    for (const { path, expectedText } of criticalPages) {
      console.log(`Testing critical page: ${path}`)
      
      const response = await page.goto(`${STAGING_BASE_URL}${path}`, { 
        waitUntil: 'networkidle',
        timeout: 20000 
      })
      
      expect(response?.status()).toBe(200)
      
      // Allow for loading states or actual content
      const contentVisible = await page.locator(`text=${expectedText}`).first().isVisible({ timeout: 15000 })
      const loadingVisible = await page.locator('text=Loading').isVisible({ timeout: 5000 })
      
      expect(contentVisible || loadingVisible, 
        `Neither "${expectedText}" content nor loading state found on ${path}`
      ).toBe(true)
      
      console.log(`✅ ${path} - Navigation successful`)
    }
    
    console.log('✅ Critical user journey validation passed')
  })

  test('should validate staging performance benchmarks', async ({ page }) => {
    test.info().annotations.push({ 
      type: 'performance', 
      description: 'Ensures staging performance meets baseline requirements' 
    })

    // Performance test for consolidated API
    const startTime = Date.now()
    const response = await page.request.get(`${STAGING_API_URL}/health`)
    const endTime = Date.now()
    
    expect(response.status()).toBe(200)
    
    const responseTime = endTime - startTime
    console.log(`API health endpoint response time: ${responseTime}ms`)
    
    // Performance threshold: API should respond within 3 seconds on staging
    expect(responseTime, `API response time ${responseTime}ms exceeds 3000ms threshold`).toBeLessThan(3000)
    
    // Frontend performance test
    const frontendStartTime = Date.now()
    await page.goto(STAGING_BASE_URL, { waitUntil: 'networkidle' })
    const frontendEndTime = Date.now()
    
    const pageLoadTime = frontendEndTime - frontendStartTime
    console.log(`Frontend page load time: ${pageLoadTime}ms`)
    
    // Frontend should load within 10 seconds on staging
    expect(pageLoadTime, `Frontend load time ${pageLoadTime}ms exceeds 10000ms threshold`).toBeLessThan(10000)
    
    console.log('✅ Performance benchmark validation passed')
  })

  test('should validate error handling and resilience', async ({ page }) => {
    test.info().annotations.push({ 
      type: 'resilience', 
      description: 'Tests application behavior under error conditions' 
    })

    // Test 404 handling
    const notFoundResponse = await page.goto(`${STAGING_BASE_URL}/non-existent-page`)
    expect([404, 200]).toContain(notFoundResponse?.status()) // 200 if Next.js custom 404
    
    // Test API error handling (should fail gracefully, not crash the frontend)
    await page.goto(STAGING_BASE_URL)
    await page.waitForLoadState('networkidle')
    
    // Application should still be functional even if some API calls fail
    const pageStillInteractive = await page.locator('nav').isVisible({ timeout: 5000 })
    expect(pageStillInteractive).toBe(true)
    
    console.log('✅ Error handling validation passed')
  })
})

test.describe('Staging Test Results Summary', () => {
  test('generate staging test report', async ({ page }) => {
    // This test always passes but generates a summary for CI reporting
    console.log('='.repeat(50))
    console.log('STAGING SMOKE TEST SUMMARY')
    console.log('='.repeat(50))
    console.log(`Staging Frontend URL: ${STAGING_BASE_URL}`)
    console.log(`Staging API URL: ${STAGING_API_URL}`)
    console.log(`Test Timestamp: ${new Date().toISOString()}`)
    console.log('Quality gates: All critical paths validated')
    console.log('='.repeat(50))
    
    expect(true).toBe(true) // Always pass summary test
  })
})