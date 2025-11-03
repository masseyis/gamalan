# Sprint Task Board E2E Tests - User Guide

## Quick Start

```bash
# Navigate to web app directory
cd /Users/jamesmassey/ai-dev/gamalan/ai-agile/apps/web

# Run all sprint task board E2E tests
npx playwright test tests/e2e/workflows/sprint-task-board
```

## Test Files Overview

### 1. `sprint-task-board-page.authenticated.spec.ts` (35 tests)
**Primary test suite covering core acceptance criteria**

Tests all primary user stories and acceptance criteria:
- ✅ AC1: Display all task information (ID, title, status, owner, story, AC refs)
- ✅ AC2: Filter by status and group by story/status with counts
- ✅ AC4: Real-time updates without page refresh
- ✅ AC5: Sprint metadata (name, dates, progress, story count)

### 2. `sprint-task-board-enhanced.authenticated.spec.ts` (20 tests)
**Enhanced test suite covering edge cases and quality attributes**

Additional coverage for:
- Real-time connection indicators
- Complex filter combinations
- Accessibility (keyboard navigation, ARIA labels)
- Performance and responsiveness
- WebSocket reconnection scenarios
- Data integrity validation
- User experience flows

## Running Tests

### Run All Sprint Task Board Tests
```bash
npx playwright test tests/e2e/workflows/sprint-task-board
```

### Run Specific Test File
```bash
# Primary test suite only
npx playwright test tests/e2e/workflows/sprint-task-board-page.authenticated.spec.ts

# Enhanced test suite only
npx playwright test tests/e2e/workflows/sprint-task-board-enhanced.authenticated.spec.ts
```

### Run Tests by Acceptance Criteria
```bash
# Tests for AC1 (Display all task info)
npx playwright test --grep "AC 7852bac8"

# Tests for AC2 (Filter and group)
npx playwright test --grep "AC a2ef8786"

# Tests for AC4 (Real-time updates)
npx playwright test --grep "AC 728fd41e"

# Tests for AC5 (Sprint metadata)
npx playwright test --grep "AC d4d41a1f"
```

### Run Tests with UI Mode (Debugging)
```bash
npx playwright test --ui tests/e2e/workflows/sprint-task-board
```

### Run Tests in Headed Mode (See Browser)
```bash
npx playwright test --headed tests/e2e/workflows/sprint-task-board
```

### Run Specific Test by Name
```bash
npx playwright test --grep "should display WebSocket connection status indicator"
```

## Test Configuration

### Prerequisites
1. **Development server must be running** (or will be started automatically)
2. **Backend services** should be available at:
   - Projects API: `http://localhost:8001`
   - Backlog API: `http://localhost:8002`
   - Readiness API: `http://localhost:8003`
   - Prompt Builder API: `http://localhost:8004`
3. **Clerk authentication** configured with test credentials

### Authentication
Tests use Clerk authentication with a test user:
- Storage state: `tests/playwright/.clerk/user.json`
- Test user is authenticated via global setup
- All tests run as authenticated user

### Timeouts
- **Action timeout**: 60 seconds
- **Navigation timeout**: 120 seconds
- **Global timeout**: 10 minutes

### Retry Policy
- **CI environment**: 2 retries
- **Local environment**: 0 retries

## Understanding Test Results

### Successful Test Run
```
Running 55 tests using 1 worker
  ✓ [authenticated tests] sprint-task-board-page.authenticated.spec.ts:108:9
  ✓ [authenticated tests] sprint-task-board-page.authenticated.spec.ts:132:9
  ...
  55 passed (5m)
```

### Failed Test
```
  1) [authenticated tests] › workflows/sprint-task-board-page.authenticated.spec.ts:108:9
     Error: expect(received).toBeVisible()

     Call log:
     - waiting for locator('[data-testid="sprint-task-board"]')
```

### View Test Report
```bash
# Open HTML report
npx playwright show-report

# Generate new report
npx playwright test tests/e2e/workflows/sprint-task-board --reporter=html
```

## Debugging Failed Tests

### 1. Run Test in Debug Mode
```bash
npx playwright test --debug tests/e2e/workflows/sprint-task-board-page.authenticated.spec.ts
```

### 2. View Screenshots on Failure
Screenshots are automatically captured on failure:
```bash
ls test-results/
```

### 3. View Trace Files
Traces are captured on first retry:
```bash
npx playwright show-trace test-results/.../trace.zip
```

### 4. Run Single Test
```bash
npx playwright test tests/e2e/workflows/sprint-task-board-page.authenticated.spec.ts:108
```

### 5. Increase Timeout for Debugging
```bash
npx playwright test --timeout=300000 tests/e2e/workflows/sprint-task-board
```

## Common Issues and Solutions

### Issue: "WebSocket connection failed"
**Solution**: Ensure the WebSocket server is running and accessible
```bash
# Check if WebSocket endpoint is available
curl http://localhost:3000/api/websocket
```

### Issue: "Task not found" or empty task list
**Solution**: Check that stories and tasks are being created in `beforeAll`
- Review test data setup
- Check backend API responses
- Verify database seeding

### Issue: "Authentication failed"
**Solution**: Regenerate authentication state
```bash
# Run global setup to refresh auth
npx playwright test tests/e2e/global.setup.ts
```

### Issue: "Tests timing out"
**Solution**: Increase timeouts or check backend performance
```bash
# Run with increased timeout
npx playwright test --timeout=180000 tests/e2e/workflows/sprint-task-board
```

### Issue: "Connection indicator not green"
**Solution**: Verify WebSocket connection is established
- Check browser console for WebSocket errors
- Ensure backend WebSocket server is running
- Verify no network issues blocking WebSocket

## Test Data Management

### Test Data Setup
- Each test suite creates its own isolated project and sprint
- Stories and tasks are created programmatically in `beforeAll`
- Data is specific to each test run

### Test Data Cleanup
- Projects are deleted in `afterAll`
- Cleanup failures are silently ignored
- Manual cleanup may be needed if tests are interrupted

### Manual Cleanup
```bash
# If tests leave orphaned data, clean up manually through UI
# Or use API to delete test projects
curl -X DELETE http://localhost:8001/api/projects/{projectId}
```

## Test Maintenance

### Adding New Tests
1. Follow existing patterns in test files
2. Use descriptive test names with AC references
3. Add tests to appropriate describe blocks
4. Update coverage documentation

### Modifying Existing Tests
1. Ensure changes don't break other tests
2. Update test descriptions if behavior changes
3. Maintain AC references for traceability
4. Run full suite after modifications

### Best Practices
- ✅ Use `data-testid` attributes for reliable selectors
- ✅ Wait for elements with appropriate timeouts
- ✅ Test both positive and negative scenarios
- ✅ Verify real-time updates without page refresh
- ✅ Clean up test data in `afterAll`
- ✅ Use meaningful assertion messages
- ✅ Group related tests in describe blocks

## Performance Considerations

### Parallel Execution
Tests can run in parallel on different workers:
```bash
# Run with 4 parallel workers
npx playwright test --workers=4 tests/e2e/workflows/sprint-task-board
```

### Selective Test Execution
Run only necessary tests during development:
```bash
# Run tests for specific feature
npx playwright test --grep "filter"

# Skip slow tests
npx playwright test --grep-invert "performance"
```

### Optimize Test Speed
- Use `beforeAll` for expensive setup
- Share authentication state across tests
- Minimize wait times with specific selectors
- Avoid unnecessary page navigations

## CI/CD Integration

### GitHub Actions
Tests run automatically on:
- Pull requests to main
- Pushes to main
- Manual workflow dispatch

### CI Configuration
```yaml
- name: Run Sprint Task Board E2E Tests
  run: |
    npx playwright test tests/e2e/workflows/sprint-task-board
  env:
    CI: true
```

### CI-Specific Settings
- Retries: 2 (vs 0 locally)
- Workers: 1 (sequential execution)
- Headless: true
- Screenshots: on failure
- Traces: on first retry

## Additional Resources

- [Playwright Documentation](https://playwright.dev)
- [Test Coverage Summary](./SPRINT_TASK_BOARD_TEST_COVERAGE.md)
- [Project README](../../../README.md)
- [E2E Test Guidelines](../README.md)

## Support

For issues or questions:
1. Check this README
2. Review test coverage documentation
3. Check Playwright logs and traces
4. Consult team documentation
5. Ask in team chat

---

**Last Updated**: 2025-01-01
**Total Tests**: 55
**Test Coverage**: Comprehensive (all ACs covered)
