# Task Analysis E2E Test Documentation

## Overview

This E2E test suite validates the **Task Readiness Analysis and Enhancement Recommendations** workflow for the Battra AI project. It comprehensively tests all acceptance criteria (ACs) for task analysis functionality.

## Test File

- **Location**: `apps/web/tests/e2e/workflows/task-analysis.authenticated.spec.ts`
- **Page Object**: `apps/web/tests/e2e/page-objects/task-analysis-page.ts`
- **Authentication**: Uses Clerk authenticated storage state
- **Estimated Runtime**: ~3 hours (as specified in task)

## Acceptance Criteria Coverage

### ✅ AC e0261453: Clarity Score Display
- **Given**: I am viewing a task in the backlog
- **When**: The task readiness analysis runs
- **Then**: I should see a clarity score indicating how well-defined the task is

**Tests**:
- `should display clarity score after analyzing a task` - Verifies score (0-100) and level display
- `should show poor clarity score for vague task` - Tests low-quality task detection
- `should show high clarity score for well-defined task` - Tests high-quality task recognition

---

### ✅ AC 81054dee: Technical Details Recommendations
- **Given**: A task description lacks specific technical details
- **When**: The analysis evaluates the task
- **Then**: System recommends adding file paths, functions, inputs/outputs, technical approach

**Tests**:
- `should recommend adding file paths when missing`
- `should recommend adding function/component names when missing`
- `should recommend adding expected inputs/outputs when missing`
- `should recommend technical approach when missing`

---

### ✅ AC 30639999: Vague Language Detection
- **Given**: A task has vague or ambiguous language
- **When**: The analysis evaluates the task
- **Then**: System flags vague terms and recommends concrete actions

**Tests**:
- `should flag vague term "implement" without specifics`
- `should flag vague term "create" without specifics`
- `should flag vague term "build" without specifics`
- `should flag vague term "add" without specifics`
- `should flag vague term "fix" without specifics`
- `should recommend concrete actions with measurable outcomes`

---

### ✅ AC 5649e91e: Acceptance Criteria References
- **Given**: A task is missing acceptance criteria references
- **When**: The analysis evaluates the task
- **Then**: System recommends linking to specific AC IDs

**Tests**:
- `should recommend linking to AC IDs when missing`
- `should suggest which ACs the task addresses`
- `should not recommend AC refs when already present`

---

### ✅ AC 3f42fa09: AI Agent Compatibility
- **Given**: A task is analyzed for AI agent compatibility
- **When**: The readiness check runs
- **Then**: System evaluates success criteria, dependencies, environment, tests, DoD

**Tests**:
- `should check for clear success criteria`
- `should check for explicit dependencies`
- `should check for required environment setup`
- `should check for expected test coverage`
- `should check for definition of done`
- `should pass AI compatibility for well-defined task`

---

### ✅ AC dd7b8a3c: AI-Assisted Task Enrichment
- **Given**: I select a task to enhance
- **When**: I request AI-assisted task enrichment
- **Then**: System generates detailed description based on context

**Tests**:
- `should allow requesting AI-assisted enrichment`
- `should generate detailed task description from context`
- `should present enrichment as reviewable suggestion`

---

### ✅ AC bbd83897: Examples and Apply Recommendations
- **Given**: A task analysis is complete
- **When**: I view the recommendations
- **Then**: I see examples and can apply enhancements with one click

**Tests**:
- `should show well-defined task examples`
- `should show examples from same project when available`
- `should allow applying recommendations with one click`
- `should show priority badges on recommendations`

---

### ✅ Complete Workflow Tests
- `should complete full analysis workflow from task creation to recommendations`
- `should handle well-defined task with no recommendations`

## Page Object: TaskAnalysisPage

### Key Methods

#### Navigation
- `gotoTask(projectId, storyId, taskId?)` - Navigate to task detail page
- `analyzeTask()` - Trigger task analysis
- `enrichTask()` - Trigger AI-assisted enrichment

#### Score Retrieval
- `getClarityScore()` - Returns numeric score (0-100)
- `getClarityLevel()` - Returns level string (poor/fair/good/excellent)

#### Category Expansion
- `expandCategory(category)` - Expand recommendation category section
- `getCategoryItemCount(category)` - Get count badge number
- `getCategoryRecommendations(category)` - Get all recommendation texts

#### Verification Methods
- `expectAnalysisPanelVisible()` - Assert panel displayed
- `expectClarityScore(min, max)` - Assert score in range
- `expectClarityLevel(level)` - Assert specific level
- `expectRecommendationExists(category, text)` - Assert recommendation present
- `expectVagueTermFlagged(term)` - Assert vague term detected
- `expectMissingElement(category, description)` - Assert missing element shown
- `expectAICompatibilityIssue(issueText)` - Assert AI compatibility issue shown
- `expectExampleShown(exampleTitle)` - Assert example displayed
- `expectPriorityBadge(category, priority)` - Assert priority badge shown
- `expectNoRecommendations()` - Assert "no recommendations" message

#### Actions
- `applyRecommendation(recommendationText)` - Click apply button for recommendation
- `getTotalRecommendationCount()` - Count recommendations across all categories

### Recommendation Categories

1. **technical-details** - File paths, functions, inputs/outputs, technical approach
2. **vague-terms** - Ambiguous language that needs clarification
3. **acceptance-criteria** - AC reference linkage
4. **ai-compatibility** - AI agent execution requirements
5. **examples** - Well-defined task examples from project/domain

## Running the Tests

### Prerequisites
```bash
# Install dependencies
npm install

# Setup Clerk authentication
npm run setup:e2e-auth
```

### Run All Task Analysis Tests
```bash
# Run in headed mode (see browser)
npx playwright test task-analysis --headed

# Run in headless mode (CI)
npx playwright test task-analysis

# Run specific test
npx playwright test task-analysis -g "should display clarity score"

# Debug mode
npx playwright test task-analysis --debug
```

### Run with Different Browsers
```bash
# Chromium only
npx playwright test task-analysis --project=chromium

# All browsers
npx playwright test task-analysis --project=chromium --project=firefox --project=webkit
```

## Test Data Strategy

### Project & Story Setup
- **BeforeAll**: Creates test project and story with 3 acceptance criteria
- **Test Isolation**: Each test creates its own task with unique ID
- **AfterAll**: Cleans up test project

### Task Variations Tested
1. **Vague tasks** - Minimal details, generic language
2. **Partial tasks** - Some details, missing elements
3. **Well-defined tasks** - Complete details, all elements present

### Example Vague Task
```
Title: "Vague Task"
Description: "Implement the feature"
```

### Example Well-Defined Task
```
Title: "Well-Defined Task"
Description: "Update UserService.authenticate() method in services/auth/user-service.ts
- Add JWT token validation using jose library
- Return AuthResult with user ID and permissions
- Handle expired token error with custom AuthTokenExpiredError
- Add unit tests for valid/invalid/expired token scenarios
- Acceptance Criteria: AC-001, AC-002
- Dependencies: jose@5.1.0 must be installed
- Expected test coverage: 95%"
```

## Architecture Integration

### Backend Services
- **Readiness Service**: `services/readiness/`
  - Endpoint: `POST /readiness/{story_id}/evaluate`
  - Response: `{ score, missingItems, recommendations, summary, isReady }`

### Frontend Components
- **RecommendationsPanel**: `apps/web/components/tasks/RecommendationsPanel.tsx`
  - Displays 5 collapsible category sections
  - Shows clarity score with color coding
  - Provides "Apply" buttons for actionable recommendations

### Type Definitions
- **TaskReadinessAnalysis**: `apps/web/lib/types/task-readiness.ts`
  - ClarityScore, VagueTerm, MissingElement, Recommendation types
  - Full analysis result structure

## CI/CD Integration

### GitHub Actions Workflow
```yaml
- name: Run Task Analysis E2E Tests
  run: npx playwright test task-analysis
  env:
    E2E_CLERK_USER_USERNAME: ${{ secrets.E2E_CLERK_USER_USERNAME }}
    E2E_CLERK_USER_PASSWORD: ${{ secrets.E2E_CLERK_USER_PASSWORD }}
```

### Required Secrets
- `E2E_CLERK_USER_USERNAME` - Test user email
- `E2E_CLERK_USER_PASSWORD` - Test user password

## Debugging Tips

### View Test Report
```bash
npx playwright show-report
```

### Generate Trace
```bash
npx playwright test task-analysis --trace on
npx playwright show-trace trace.zip
```

### Screenshot on Failure
Tests automatically capture screenshots on failure in `test-results/` directory.

### Common Issues

#### Issue: "Analysis panel not visible"
**Solution**: Ensure backend readiness service is running and reachable.

#### Issue: "Toast message timeout"
**Solution**: Check network tab for API call failures. Verify backend endpoints.

#### Issue: "Recommendations not found"
**Solution**: Verify task description triggers analysis rules. Check backend logs.

## Test Maintenance

### Adding New Tests
1. Follow existing test structure and naming
2. Use descriptive test titles starting with "should"
3. Reference specific AC IDs in describe blocks
4. Use page object methods (don't access page directly)
5. Add unique IDs to test data: `testUtils.generateUniqueId()`

### Updating Page Objects
1. Add new locators as readonly properties
2. Create helper methods for complex interactions
3. Use semantic selectors (data-testid preferred)
4. Add JSDoc comments for public methods

### Handling UI Changes
1. Update locators in `TaskAnalysisPage` only
2. Tests should remain unchanged if page object is updated correctly
3. Use flexible selectors (text content, semantic roles)

## Related Documentation

- **Readiness Service**: `services/readiness/README.md`
- **Recommendation System**: `docs/RECOMMENDATION_SYSTEM.md`
- **E2E Test Guide**: `apps/web/tests/e2e/README.md`
- **Task Readiness Types**: `apps/web/lib/types/task-readiness.ts`

## Hexagonal Architecture Compliance

This E2E test validates the **complete user journey** through all hexagonal layers:

1. **UI Layer** (Adapters): RecommendationsPanel component
2. **HTTP API** (Adapters): `/readiness/{story_id}/evaluate` endpoint
3. **Application Layer**: Task analysis use cases
4. **Domain Layer**: TaskAnalyzer logic, clarity scoring rules
5. **Persistence** (Adapters): Task and criteria repositories

## Success Metrics

- ✅ All 7 acceptance criteria validated with multiple test cases
- ✅ 30+ individual test scenarios
- ✅ Complete workflow coverage (create → analyze → view → apply)
- ✅ Both positive and negative cases tested
- ✅ Page Object Model for maintainability
- ✅ Proper test isolation and cleanup
- ✅ Follows existing E2E test patterns

## Contact

For questions or issues with this test suite:
- **Task ID**: ee410228-c7f2-4821-b913-9e7c2c9ec4a2
- **Story**: Task Readiness Analysis and Enhancement Recommendations
- **Test File**: `apps/web/tests/e2e/workflows/task-analysis.authenticated.spec.ts`
