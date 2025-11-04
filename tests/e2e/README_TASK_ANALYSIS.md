# Task Analysis E2E Test Documentation

## Overview

This document describes the End-to-End (E2E) test suite for the **Task Readiness Analysis and Enhancement Recommendations** feature.

**Test File:** `tests/e2e/task-analysis.spec.ts`

**Story:** Task Readiness Analysis and Enhancement Recommendations
**Task ID:** ee410228-c7f2-4821-b913-9e7c2c9ec4a2

## Purpose

The task analysis feature provides AI-powered analysis of task definitions to:
- Evaluate task clarity and completeness
- Identify gaps and missing information
- Provide specific, actionable recommendations
- Generate AI-assisted task enrichment
- Assess AI agent readiness

This E2E test suite comprehensively validates the entire workflow from task creation through analysis to applying recommendations.

## Acceptance Criteria Coverage

The test suite covers all 7 acceptance criteria:

### AC e0261453: Clarity Score Display
- **Given:** Viewing a task in the backlog
- **When:** Task readiness analysis runs
- **Then:** See clarity score (0-100) with specific recommendations

**Tests:**
- `should display clarity score with recommendations when viewing task`
- `should show high clarity score for well-defined tasks`

---

### AC 81054dee: Technical Details Recommendations
- **Given:** Task lacks specific technical details
- **When:** Analysis evaluates the task
- **Then:** System recommends adding:
  - File paths to modify
  - Specific functions/components
  - Expected inputs/outputs
  - Technical approach/architecture

**Tests:**
- `should recommend technical details when task lacks specifics`
- `should provide examples in technical recommendations`

---

### AC 30639999: Vague Language Detection
- **Given:** Task has vague or ambiguous language
- **When:** Analysis evaluates the task
- **Then:** System flags vague terms (implement, create, build, add, fix) and recommends concrete actions

**Tests:**
- `should flag vague terms in task descriptions`
- `should recommend replacing vague terms with specifics`

---

### AC 5649e91e: Missing Acceptance Criteria
- **Given:** Task missing acceptance criteria references
- **When:** Analysis evaluates the task
- **Then:** System recommends linking to specific AC IDs and suggests which ACs to address

**Tests:**
- `should detect when task is missing AC references`
- `should show valid status when task properly links to ACs`

---

### AC 3f42fa09: AI Agent Compatibility
- **Given:** Task analyzed for AI agent compatibility
- **When:** Readiness check runs
- **Then:** System evaluates:
  - Clear success criteria
  - Explicit dependencies
  - Required environment setup
  - Expected test coverage
  - Definition of done

**Tests:**
- `should evaluate task for AI agent compatibility`
- `should show AI-ready badge for fully qualified tasks`

---

### AC dd7b8a3c: AI-Assisted Task Enrichment
- **Given:** Selecting a task to enhance
- **When:** Requesting AI-assisted enrichment
- **Then:** System generates detailed description based on story context, related tasks, ACs, and codebase

**Tests:**
- `should generate detailed task description using AI`
- `should use story context for enrichment`
- `should allow accepting enrichment suggestions`

---

### AC bbd83897: One-Click Enhancement Application
- **Given:** Task analysis complete
- **When:** Viewing recommendations
- **Then:** See well-defined task examples and apply enhancements with one click

**Tests:**
- `should show examples of well-defined tasks`
- `should allow one-click application of recommendations`
- `should allow applying multiple recommendations at once`

---

## Test Structure

### Helper Functions

The test suite includes comprehensive helper functions for test setup:

```typescript
setupTestEnvironment(page: Page): Promise<void>
```
Authenticates the test user via Clerk.

```typescript
createTestProject(page: Page, name: string): Promise<string>
```
Creates a test project and returns its ID.

```typescript
createTestStory(page: Page, projectId: string, title: string, description?: string): Promise<string>
```
Creates a story within a project.

```typescript
createTestTask(page: Page, storyId: string, title: string, description?: string, acRefs?: string[]): Promise<string>
```
Creates a task with optional description and AC links.

```typescript
createAcceptanceCriteria(page: Page, storyId: string, criteria: Criterion[]): Promise<string[]>
```
Creates acceptance criteria in Given/When/Then format.

### Test Data IDs

The tests rely on consistent `data-testid` attributes in the UI:

#### Analysis UI Elements
- `analyze-task-button` - Triggers task analysis
- `analysis-results` - Container for analysis results
- `clarity-score` - Displays 0-100 clarity score
- `recommendations-list` - List of recommendations
- `gaps-list` - List of identified gaps
- `ai-agent-ready-badge` - Shows AI readiness status
- `ai-compatibility-checklist` - Checklist of AI requirements
- `ai-ready-status` - Overall AI readiness indicator

#### Recommendation Elements
- `recommendation-{id}` - Individual recommendation item
- `recommendation-example` - Example text within recommendation
- `recommendation-priority` - Priority indicator
- `apply-recommendation-button` - Applies single recommendation
- `recommendation-checkbox` - Checkbox for bulk selection
- `apply-selected-recommendations-button` - Applies multiple selected
- `apply-all-recommendations-button` - Applies all recommendations

#### Enrichment Elements
- `enrich-task-button` - Triggers AI enrichment
- `enrichment-suggestion` - Generated enrichment content
- `review-enrichment-panel` - Review panel for suggestions
- `accept-enrichment-button` - Accepts enrichment
- `reject-enrichment-button` - Rejects enrichment
- `edit-enrichment-button` - Opens editor for enrichment

#### Gap and Issue Detection
- `vague-terms-highlight` - Highlights vague language
- `vague-term-{term}` - Individual flagged term
- `replacement-suggestions` - Suggested replacements
- `suggested-acs-list` - Suggested AC links
- `suggested-ac-{id}` - Individual AC suggestion
- `linked-acs-display` - Shows currently linked ACs

#### Examples and Learning
- `example-tasks-section` - Section showing example tasks
- `example-task-{id}` - Individual example task
- `example-task-title` - Title of example
- `example-task-description` - Description of example
- `example-clarity-score` - Score of example task
- `example-rationale` - Why this is a good example

#### Status and Feedback
- `task-updated-indicator` - Shows task was updated
- `task-improvement-badge` - Shows improvement after changes
- `recommendation-applied-toast` - Toast notification for applied rec
- `bulk-apply-complete-toast` - Toast for bulk application complete
- `recommendations-applied-toast` - Toast for all recommendations applied
- `task-description-updated` - Indicator that description changed
- `task-description-display` - Current task description

## Running the Tests

### Prerequisites

1. **Environment Variables:**
   ```bash
   export TEST_USER_EMAIL="test@example.com"
   export TEST_USER_PASSWORD="testpass123"
   ```

2. **Services Running:**
   - Frontend (Next.js) on http://localhost:3000
   - API Gateway with all services
   - PostgreSQL database
   - Clerk authentication configured

### Running All Tests

```bash
cd ai-agile
npm run test:e2e tests/e2e/task-analysis.spec.ts
```

### Running Specific Test Suites

```bash
# Run only clarity score tests
npm run test:e2e tests/e2e/task-analysis.spec.ts -- --grep "Clarity Score"

# Run only AI compatibility tests
npm run test:e2e tests/e2e/task-analysis.spec.ts -- --grep "AI Agent Compatibility"

# Run full workflow test
npm run test:e2e tests/e2e/task-analysis.spec.ts -- --grep "Full Analysis Workflow"
```

### Running in Different Browsers

```bash
# Chrome
npm run test:e2e tests/e2e/task-analysis.spec.ts -- --project=chromium

# Firefox
npm run test:e2e tests/e2e/task-analysis.spec.ts -- --project=firefox

# Safari
npm run test:e2e tests/e2e/task-analysis.spec.ts -- --project=webkit
```

### Debug Mode

```bash
npm run test:e2e tests/e2e/task-analysis.spec.ts -- --debug
```

## Backend Dependencies

The tests interact with these backend services:

### Readiness Service

**Domain Models:**
- `TaskAnalysis` - Contains clarity score, gaps, recommendations, AI readiness
- `TaskGap` - Represents missing or inadequate elements
- `TaskRecommendation` - Specific improvement suggestions
- `GapType` - Enumeration of gap categories
- `GapSeverity` - Critical, High, Medium, Low
- `RecommendationType` - Types of recommendations
- `RecommendationPriority` - Recommendation urgency

**Use Cases:**
- `analyze_task(task_id, story_id, organization_id)` - Analyzes task and generates recommendations
- `get_task_analysis(task_id, organization_id)` - Retrieves existing analysis

**API Endpoints (via API Gateway):**
- `POST /api/readiness/tasks/{taskId}/analyze` - Analyze task
- `GET /api/readiness/tasks/{taskId}/analysis` - Get analysis
- `POST /api/readiness/tasks/{taskId}/enrich` - AI enrichment
- `POST /api/readiness/tasks/{taskId}/apply-recommendations` - Apply recommendations

### Backlog Service

**Endpoints Used:**
- `POST /api/backlog/stories` - Create story
- `POST /api/backlog/stories/{storyId}/tasks` - Create task
- `PATCH /api/backlog/tasks/{taskId}` - Update task
- `POST /api/backlog/stories/{storyId}/criteria` - Add acceptance criteria

## Expected Test Outcomes

### Success Criteria

1. **All tests pass** with green status
2. **Clarity scores** properly calculated (0-100)
3. **Gaps detected** for poorly defined tasks
4. **Recommendations generated** with examples
5. **Vague language flagged** accurately
6. **AC references** validated correctly
7. **AI readiness** evaluated properly
8. **Enrichment suggestions** generated
9. **One-click apply** updates tasks successfully
10. **Full workflow** completes end-to-end

### Performance Expectations

- **Analysis time:** < 5 seconds per task
- **AI enrichment:** < 15 seconds
- **UI interactions:** < 2 seconds response time
- **Full workflow:** < 60 seconds total

### Test Data Cleanup

Tests create test data that should be cleaned up:
- Test projects
- Test stories
- Test tasks
- Test acceptance criteria

**Cleanup Strategy:**
- Use unique project names with timestamps
- Delete test data after test completion
- Use beforeEach/afterEach hooks for isolation

## Troubleshooting

### Common Issues

#### 1. Authentication Failures
**Symptom:** Tests fail at login
**Solution:** Verify TEST_USER_EMAIL and TEST_USER_PASSWORD are set correctly

#### 2. Timeout Errors
**Symptom:** "Timeout waiting for selector"
**Solution:**
- Check that backend services are running
- Increase timeout in test configuration
- Verify database is accessible

#### 3. Missing Elements
**Symptom:** "Element not found"
**Solution:**
- Verify frontend has implemented the data-testid attributes
- Check that feature is deployed
- Review element selector in test

#### 4. API Errors
**Symptom:** 500/404 errors in network tab
**Solution:**
- Check API Gateway logs
- Verify Readiness service is running
- Check database migrations are applied

### Debug Tips

1. **Use headed mode:**
   ```bash
   npm run test:e2e tests/e2e/task-analysis.spec.ts -- --headed
   ```

2. **Slow down execution:**
   ```bash
   npm run test:e2e tests/e2e/task-analysis.spec.ts -- --headed --slow-mo=1000
   ```

3. **Take screenshots on failure:**
   Configured in `playwright.config.ts`:
   ```typescript
   use: {
     screenshot: 'only-on-failure',
     video: 'retain-on-failure',
   }
   ```

4. **Check browser console:**
   ```typescript
   page.on('console', msg => console.log('Browser:', msg.text()))
   ```

5. **Inspect network requests:**
   ```typescript
   page.on('request', request => console.log('Request:', request.url()))
   page.on('response', response => console.log('Response:', response.status()))
   ```

## Future Enhancements

Potential additions to the test suite:

1. **Performance tests** - Measure analysis speed under load
2. **Accessibility tests** - Verify WCAG compliance
3. **Mobile responsiveness** - Test on mobile viewports
4. **Internationalization** - Test with different locales
5. **Edge cases** - Test with extremely long descriptions, special characters
6. **Batch analysis** - Test analyzing multiple tasks at once
7. **Historical analysis** - Test viewing past analysis results
8. **Comparison view** - Test before/after task enhancement

## Related Documentation

- [Task Analysis Domain Models](../../services/readiness/src/domain/task_analysis.rs)
- [Task Analyzer](../../services/readiness/src/domain/task_analyzer.rs)
- [Readiness API Spec](../../services/readiness/docs/openapi.yaml)
- [E2E Testing Guide](./README.md)
- [CLAUDE.md](../../CLAUDE.md) - Architecture guidelines

## Maintenance

### Updating Tests

When updating the task analysis feature:

1. **Add new data-testid** attributes to UI components
2. **Update helper functions** if API changes
3. **Add new test cases** for new functionality
4. **Update this documentation** with changes
5. **Run full test suite** before merging

### Test Review Checklist

Before merging test changes:

- [ ] All tests pass locally
- [ ] Tests pass in CI/CD pipeline
- [ ] Coverage meets 85% threshold
- [ ] No console errors or warnings
- [ ] Data-testid attributes are semantic
- [ ] Helper functions are reusable
- [ ] Documentation is updated
- [ ] Test data is properly cleaned up

## Contact

For questions or issues with the test suite:

- **Team:** Battra AI Development Team
- **Related Story:** Task Readiness Analysis and Enhancement Recommendations
- **Task ID:** ee410228-c7f2-4821-b913-9e7c2c9ec4a2
