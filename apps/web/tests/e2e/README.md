# E2E Testing Suite

This comprehensive End-to-End testing suite validates the complete user experience of the Battra AI project management platform using Playwright and Clerk's official testing approach.

## 🎯 Testing Philosophy

Our E2E testing strategy follows the **Testing Pyramid** principles with comprehensive validation of:

- **Authentication flows** using real Clerk integration
- **Core user journeys** from project creation to completion
- **Cross-browser compatibility** across Chrome, Firefox, and Safari
- **Mobile responsiveness** and accessibility
- **Error handling** and edge cases
- **Performance** and stress testing

## 📁 Test Structure

```
tests/e2e/
├── page-objects/          # Page Object Model (POM) classes
│   ├── base-page.ts       # Common page functionality
│   ├── auth-page.ts       # Authentication flows
│   ├── projects-page.ts   # Project management
│   ├── backlog-page.ts    # Story and backlog management
│   ├── board-page.ts      # Sprint board operations
│   ├── assistant-page.ts  # AI assistant interactions
│   └── index.ts           # Exports and test utilities
├── auth/                  # Authentication workflow tests
├── workflows/             # Core application workflows
├── cross-browser/         # Browser compatibility tests
├── edge-cases/            # Error handling and stress tests
├── global.setup.ts        # Global test setup (authentication)
└── README.md             # This file
```

## 🔧 Configuration Files

- `playwright.config.ts` - Default configuration for local development
- `playwright.config.ci.ts` - CI/CD optimized configuration
- `playwright.config.cross-browser.ts` - Multi-browser testing
- `playwright.config.staging.ts` - Staging environment testing

## 🚀 Quick Start

### Prerequisites

```bash
# Install dependencies
pnpm install

# Install Playwright browsers
pnpm playwright install
```

### Environment Setup

1. **Test Environment Variables** (`.env.test`):
```bash
# Clerk test keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
E2E_CLERK_USER_USERNAME=test@example.com
E2E_CLERK_USER_PASSWORD=testpassword123

# Enable mock mode for testing
NEXT_PUBLIC_ENABLE_MOCK_AUTH=true
NEXT_PUBLIC_ENABLE_MOCK_DATA=true
NEXT_PUBLIC_ENABLE_AI_FEATURES=true
```

2. **API Endpoints**:
```bash
NEXT_PUBLIC_PROJECTS_API_URL=http://localhost:8001
NEXT_PUBLIC_BACKLOG_API_URL=http://localhost:8002
NEXT_PUBLIC_READINESS_API_URL=http://localhost:8003
NEXT_PUBLIC_PROMPT_BUILDER_API_URL=http://localhost:8004
```

### Running Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run specific test file
pnpm playwright test auth/authentication.auth.spec.ts

# Run tests in UI mode
pnpm test:e2e:ui

# Run cross-browser tests
pnpm playwright test --config=playwright.config.cross-browser.ts

# Run staging tests
pnpm test:staging
```

## 📋 Test Categories

### 1. Authentication Tests (`auth/`)

**File**: `authentication.auth.spec.ts`

- ✅ **Sign-in flow** with valid/invalid credentials
- ✅ **Sign-up flow** with validation
- ✅ **Session management** and persistence
- ✅ **Multi-device sessions**
- ✅ **Security features** (XSS, CSRF, rate limiting)

### 2. Core Workflow Tests (`workflows/`)

#### Project Management (`project-management.authenticated.spec.ts`)
- ✅ Project creation, editing, deletion
- ✅ Project navigation and settings
- ✅ Team member management
- ✅ Project archiving and restoration

#### Backlog Management (`backlog-management.authenticated.spec.ts`)
- ✅ User story creation with acceptance criteria
- ✅ Story status workflow (backlog → ready → in-progress → done)
- ✅ Story estimation and prioritization
- ✅ Task breakdown and management
- ✅ Backlog filtering and search

#### Sprint Board (`sprint-board.authenticated.spec.ts`)
- ✅ Sprint creation and management
- ✅ Task board operations (drag & drop)
- ✅ Task assignment and status updates
- ✅ Sprint metrics and burndown charts
- ✅ Sprint completion and retrospective

#### AI Assistant (`ai-assistant.authenticated.spec.ts`)
- ✅ Chat interface and conversation flows
- ✅ Context-aware assistance
- ✅ Story and task generation from AI
- ✅ Acceptance criteria generation
- ✅ Project analysis and insights

### 3. Cross-Browser Tests (`cross-browser/`)

#### Responsive Design (`responsive-design.cross-browser.spec.ts`)
- ✅ Mobile navigation adaptation
- ✅ Touch-friendly interface elements
- ✅ Responsive layouts across breakpoints
- ✅ Accessibility compliance (WCAG AA)

#### Browser Compatibility (`browser-compatibility.cross-browser.spec.ts`)
- ✅ JavaScript execution across browsers
- ✅ CSS layout compatibility
- ✅ Form handling and validation
- ✅ Event handling and interactions

### 4. Edge Cases and Error Handling (`edge-cases/`)

#### Error Handling (`error-handling.spec.ts`)
- ✅ Network failures and API errors
- ✅ Input validation and edge cases
- ✅ Security vulnerability prevention
- ✅ State management failures

#### Performance and Stress (`performance-stress.spec.ts`)
- ✅ Page load performance metrics
- ✅ Memory usage monitoring
- ✅ Large dataset handling
- ✅ Concurrent operation stress testing

## 🎭 Page Object Model (POM)

Our tests use the Page Object Model pattern for maintainability and reusability:

### Base Page (`base-page.ts`)
Common functionality shared across all pages:
```typescript
class BasePage {
  async goto(path: string)
  async waitForLoad()
  async expectAuthenticated()
  async navigateTo(section: string)
  async expectToastMessage(message: string)
}
```

### Specialized Pages
Each major application section has its own page object:
- `AuthPage` - Authentication flows
- `ProjectsPage` - Project management
- `BacklogPage` - Story and backlog operations
- `BoardPage` - Sprint board functionality
- `AssistantPage` - AI assistant interactions

### Test Utilities
```typescript
// Generate unique test data
const projectName = testUtils.generateProjectName()
const storyTitle = testUtils.generateStoryTitle()
const userEmail = testUtils.generateTestEmail()

// Mock data factories
const testData = {
  user: { email: 'test@example.com', password: 'testpassword123' },
  project: { name: 'E2E Test Project', description: '...' },
  story: { title: 'Test User Story', acceptanceCriteria: [...] }
}
```

## 🔒 Authentication Strategy

### Clerk Integration
We use Clerk's official testing approach with real authentication:

1. **Global Setup** (`global.setup.ts`):
   - Authenticates once before all tests
   - Saves authentication state to `tests/playwright/.clerk/user.json`
   - Used by authenticated test projects

2. **Test User Management**:
   - Dedicated test user account
   - Credentials managed via environment variables
   - Automatic cleanup of test data

3. **Authentication State**:
   - Persistent across test sessions
   - Separate projects for authenticated/unauthenticated tests
   - Proper session timeout handling

## 🌐 Cross-Browser Testing

### Supported Browsers
- **Desktop**: Chrome, Firefox, Safari
- **Mobile**: Chrome (Android), Safari (iOS)
- **Tablets**: iPad Pro
- **High DPI**: Retina displays

### Browser-Specific Configurations
```typescript
// Desktop browsers
{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }
{ name: 'firefox', use: { ...devices['Desktop Firefox'] } }
{ name: 'webkit', use: { ...devices['Desktop Safari'] } }

// Mobile devices
{ name: 'mobile-chrome', use: { ...devices['Pixel 5'] } }
{ name: 'mobile-safari', use: { ...devices['iPhone 12'] } }
```

## 📊 CI/CD Integration

### GitHub Actions Workflow
**File**: `.github/workflows/e2e-tests.yml`

**Jobs**:
1. **E2E Tests** (Chrome) - Main test suite
2. **Cross-Browser Tests** - Multi-browser validation
3. **Performance Tests** - Load and stress testing
4. **Accessibility Tests** - WCAG compliance
5. **Test Summary** - Aggregate results

**Triggers**:
- Push to `main`/`develop` branches
- Pull requests
- Daily scheduled runs (2 AM UTC)

### Test Reporting
- **HTML Reports** with screenshots and videos
- **JUnit XML** for CI integration
- **GitHub Annotations** for inline PR feedback
- **Test Artifacts** stored for 30 days

## 📈 Performance Standards

### Acceptance Criteria
- **Page Load**: < 5 seconds
- **First Contentful Paint**: < 3 seconds
- **JavaScript Bundle**: < 2MB total
- **CSS Bundle**: < 500KB total
- **Memory Usage**: < 100MB in browser
- **API Response**: < 10 seconds max

### Performance Monitoring
Tests include automatic performance tracking:
```typescript
test('should load within performance budget', async ({ page }) => {
  const startTime = Date.now()
  await page.goto('/projects')
  const loadTime = Date.now() - startTime

  expect(loadTime).toBeLessThan(5000) // 5 second budget
})
```

## 🛡️ Security Testing

### Vulnerability Prevention
- **XSS Protection**: Input sanitization validation
- **CSRF Protection**: Token validation
- **Authentication**: Session management security
- **Input Validation**: Boundary testing
- **File Upload**: Malicious file prevention

### Security Test Examples
```typescript
test('should prevent XSS attacks', async ({ page }) => {
  const xssPayload = '<script>alert("xss")</script>'
  await page.fill('input[name="name"]', xssPayload)

  // Verify script is not executed
  const xssExecuted = await page.evaluate(() => window.xssExecuted)
  expect(xssExecuted).toBeFalsy()
})
```

## 🔧 Debugging and Troubleshooting

### Common Issues

1. **Authentication Failures**:
   ```bash
   # Check Clerk credentials
   echo $E2E_CLERK_USER_USERNAME
   echo $E2E_CLERK_USER_PASSWORD

   # Verify mock auth is enabled
   echo $NEXT_PUBLIC_ENABLE_MOCK_AUTH
   ```

2. **Timeout Issues**:
   ```bash
   # Run with debug mode
   DEBUG=pw:api pnpm playwright test

   # Increase timeouts for slow environments
   pnpm playwright test --timeout=60000
   ```

3. **Flaky Tests**:
   ```bash
   # Run specific test multiple times
   pnpm playwright test auth.spec.ts --repeat-each=5

   # Enable trace for debugging
   pnpm playwright test --trace=on
   ```

### Debug Tools
- **Playwright Inspector**: Visual debugging
- **Trace Viewer**: Timeline analysis
- **Video Recording**: Test execution replay
- **Screenshots**: Failure point capture

```bash
# Open Playwright Inspector
pnpm playwright test --debug

# View trace files
pnpm playwright show-trace trace.zip

# Generate and view report
pnpm playwright show-report
```

## 📝 Writing New Tests

### Best Practices

1. **Use Page Objects**:
   ```typescript
   // ✅ Good
   await projectsPage.createProject(name, description)

   // ❌ Avoid
   await page.click('button:has-text("New Project")')
   ```

2. **Descriptive Test Names**:
   ```typescript
   test('should create project and navigate to backlog successfully', async () => {
     // Test implementation
   })
   ```

3. **Proper Cleanup**:
   ```typescript
   test.afterEach(async () => {
     if (createdProjectName) {
       await projectsPage.deleteProject(createdProjectName)
     }
   })
   ```

4. **Stable Selectors**:
   ```typescript
   // ✅ Good - Use data-testid
   page.locator('[data-testid="project-card"]')

   // ❌ Avoid - Fragile selectors
   page.locator('.css-class-xyz')
   ```

### Test Structure Template
```typescript
import { test, expect } from '@playwright/test'
import { ProjectsPage, testUtils } from '../page-objects'

test.describe('Feature Name Tests', () => {
  let projectsPage: ProjectsPage

  test.beforeEach(async ({ page }) => {
    projectsPage = new ProjectsPage(page)
    // Setup code
  })

  test('should perform specific action successfully', async () => {
    // Arrange
    const testData = testUtils.generateTestData()

    // Act
    await projectsPage.performAction(testData)

    // Assert
    await projectsPage.expectActionResult()
  })

  test.afterEach(async () => {
    // Cleanup code
  })
})
```

## 🤝 Contributing

### Code Review Checklist
- [ ] Tests follow Page Object Model pattern
- [ ] Proper error handling and cleanup
- [ ] Cross-browser compatibility considered
- [ ] Performance impact assessed
- [ ] Security implications reviewed
- [ ] Documentation updated

### Pull Request Requirements
- All E2E tests must pass
- New features require corresponding E2E tests
- Performance regressions are not allowed
- Accessibility standards maintained

## 📚 Resources

- [Playwright Documentation](https://playwright.dev/)
- [Clerk Testing Guide](https://clerk.dev/docs/testing)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Testing Best Practices](https://playwright.dev/docs/best-practices)
- [Page Object Model](https://playwright.dev/docs/test-pom)

---

**🎭 Happy Testing!**

This E2E test suite ensures the Battra AI platform delivers a reliable, accessible, and performant experience across all user journeys and browser environments.