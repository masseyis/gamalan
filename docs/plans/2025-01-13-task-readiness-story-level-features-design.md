# Task Readiness: Story-Level Features Design

**Date:** 2025-01-13
**Story:** Task Readiness Analysis and Enhancement Recommendations
**Story ID:** 4f35d451-9ec7-4a20-97f4-83b59f2aa5da
**Author:** Claude Code + User Collaboration

## Executive Summary

This design delivers story-level task operations for the Task Readiness feature:
- **Suggest Tasks:** AI-powered task generation using story context + GitHub codebase analysis
- **Analyze Tasks:** Batch clarity analysis of all tasks in a story

The implementation enhances the existing `readiness` service with GitHub integration, LLM-powered analysis, and CQRS projections for efficient querying.

## Business Context

**Problem:** Creating well-defined, unambiguous tasks that AI agents or junior developers can execute successfully is time-consuming and error-prone.

**Solution:** Automate task suggestion and quality analysis at the story level, using:
- Story context (title, description, acceptance criteria)
- Project history (existing tasks as examples)
- GitHub codebase structure (file paths, code patterns)
- LLM reasoning (GPT-4 or Claude)

**Success Metric:** Tasks meet the "AI agent/junior dev 80% success rate" threshold

## Architecture Overview

### Service Boundaries

We enhance the existing **readiness service** to support:
1. Task Analysis (individual + batch)
2. Task Suggestion (LLM + GitHub)
3. GitHub Integration

**Why readiness service?**
- Already has task analysis scaffolding
- Owns the "task quality" domain
- Has LLM client infrastructure
- Avoids service proliferation

### CQRS Event-Driven Architecture

```
User Action → Command → Domain Event → Projection Update → Query
```

**New Domain Events:**
- `TaskAnalysisRequested(task_id, story_id)`
- `TaskAnalyzed(task_id, analysis_result, timestamp)`
- `StoryAnalysisRequested(story_id)`
- `StoryAnalysisCompleted(story_id, summary)`
- `TaskSuggestionRequested(story_id, context)`
- `TaskSuggestionsGenerated(story_id, suggestions[])`

**Projections (Read Models):**
- `task_analyses` - Individual task analysis results
- `story_analysis_summaries` - Aggregated view grouped by issues
- `task_suggestions` - Generated suggestions awaiting user approval
- `github_repo_configs` - Per-project GitHub repo settings

## Domain Models

### Task Clarity Score

**Scoring Algorithm (0-100, weighted):**
- Technical Specificity (25%) - File paths, functions, components present
- Vague Language (15%) - Flags "implement", "add", "fix", "create" without context
- AC References (20%) - Links to specific acceptance criteria
- Success Criteria (15%) - Measurable "done" definition
- Dependencies (10%) - Explicit prerequisites listed
- Test Expectations (15%) - What tests should exist

**Thresholds:**
- 85-100: Excellent (ready for AI agents)
- 70-84: Good (ready for junior devs)
- 40-69: Fair (needs refinement)
- 0-39: Poor (too vague)

**80% = "AI agent/junior dev success rate" target**

### Core Domain Types

```rust
// Task Analysis Result
struct TaskAnalysis {
    task_id: Uuid,
    story_id: Uuid,
    clarity_score: ClarityScore,
    vague_terms: Vec<VagueTerm>,
    missing_elements: Vec<MissingElement>,
    recommendations: Vec<Recommendation>,
    analyzed_at: DateTime<Utc>,
}

struct ClarityScore {
    overall: u8,                // 0-100
    technical_specificity: u8,  // 0-100
    vague_language: u8,         // 0-100
    ac_references: u8,          // 0-100
    success_criteria: u8,       // 0-100
    dependencies: u8,           // 0-100
    test_expectations: u8,      // 0-100
}

struct VagueTerm {
    term: String,
    position: usize,
    context: String,
    suggestion: String,
}

struct MissingElement {
    element: String,
    category: MissingElementCategory,
    description: String,
    importance: Importance,
}

enum MissingElementCategory {
    TechnicalDetails,
    AcceptanceCriteria,
    SuccessCriteria,
    Dependencies,
    TestExpectations,
}

struct Recommendation {
    id: Uuid,
    category: RecommendationCategory,
    priority: Priority,
    title: String,
    description: String,
    actionable: bool,
}

// Task Suggestion
struct TaskSuggestion {
    id: Uuid,
    story_id: Uuid,
    title: String,
    description: String,
    suggested_files: Vec<String>,           // From GitHub
    related_code_examples: Vec<CodeExample>, // From GitHub search
    confidence: u8,                         // LLM confidence 0-100
    acceptance_criteria_refs: Vec<Uuid>,
    estimated_hours: Option<f32>,
}

struct CodeExample {
    file_path: String,
    repo_url: String,
    snippet: String,
    relevance: String,  // Why this example matters
}
```

## GitHub Integration

### GitHubPort Trait

```rust
pub trait GitHubPort {
    async fn get_repo_structure(&self, repo_url: &str) -> Result<RepoStructure>;
    async fn search_code(&self, repo_url: &str, query: &str) -> Result<Vec<CodeSearchResult>>;
}
```

### Operations

**1. Get Repo Structure**
- API: `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1`
- Returns: Full file tree (paths only, no contents)
- Use case: Suggest specific file paths in tasks
- Cache: 1 hour

**2. Search Code**
- API: `GET /search/code?q={query}+repo:{owner}/{repo}`
- Query examples: "class:Component", "function:handleSubmit"
- Returns: File paths + code snippets
- Use case: Provide relevant code examples in task suggestions

### Configuration

**Storage:** `github_repo_configs` table
- Per-project GitHub repo URL
- Default branch (usually "main")
- Last validated timestamp

**Authentication:** Organization-level GitHub OAuth token
- Stored in Clerk organization settings
- Used for all API calls
- Follows existing auth pattern

### Fallback Behavior

- **No GitHub token:** Skip GitHub-enhanced suggestions, use story context only
- **No repo URL:** Skip GitHub integration
- **API failure:** Log warning, continue with available data

### Rate Limiting

- GitHub API: 5000 requests/hour (authenticated)
- Cache repo structure for 1 hour
- Batch search queries where possible

## LLM Integration

### LLMPort Trait

```rust
pub trait LLMPort {
    async fn analyze_task(&self, context: TaskAnalysisContext) -> Result<TaskAnalysis>;
    async fn suggest_tasks(&self, context: TaskSuggestionContext) -> Result<Vec<TaskSuggestion>>;
}
```

### Provider Strategy

**Primary:** Anthropic Claude API (claude-3-5-sonnet-20241022)
**Fallback:** OpenAI API (gpt-4-turbo-preview)

**Selection Logic:**
```rust
if env::var("ANTHROPIC_API_KEY").is_ok() {
    LLMProvider::Anthropic
} else if env::var("OPENAI_API_KEY").is_ok() {
    LLMProvider::OpenAI
} else {
    return Err("No LLM API key configured")
}
```

### Task Analysis Prompt

```
You are analyzing a task for an AI agent or junior developer.

Evaluate against these criteria:
1. Technical specificity (file paths, functions, components)
2. Vague language (flag "implement", "add" without details)
3. AC references (links to acceptance criteria)
4. Success criteria (measurable done definition)
5. Dependencies (what must exist first)
6. Test expectations (what tests to write)

Task Title: {title}
Task Description: {description}

Story Context:
- Title: {story_title}
- Description: {story_description}

Acceptance Criteria:
{ac_list}

Return JSON matching TaskAnalysis schema with:
- Clarity scores (0-100) for each criterion
- List of vague terms with suggestions
- Missing elements with importance
- Specific recommendations

Target: 80/100 clarity score for AI agent success.
```

### Task Suggestion Prompt

```
Generate technical tasks for this user story.

Story Title: {title}
Story Description: {description}

Acceptance Criteria:
{ac_list}

Existing Tasks (as examples):
{existing_tasks}

Project Structure (GitHub):
{file_tree}

Relevant Code Examples (GitHub):
{code_examples}

Generate 5-8 tasks that:
- Have specific file paths to modify/create
- Reference functions/components to implement
- Link to relevant acceptance criteria
- Include test expectations
- Are sized for 2-4 hours of work
- Follow patterns from existing tasks

Each task must score 80+ on clarity (ready for AI agents).

Return JSON array of TaskSuggestion objects.
```

## REST API Endpoints

All endpoints in `readiness` service:

### Story-Level Operations

```
POST /api/v1/stories/{story_id}/tasks/analyze
  Request: {} (empty body)
  Response: { analysis_id: UUID, status: "processing" }

  Triggers async analysis of all tasks in story.
  Returns immediately with tracking ID.

GET /api/v1/stories/{story_id}/task-analyses
  Response: TaskAnalysis[]

  Returns individual task analysis results.
  Used for initial simple list UI.

GET /api/v1/stories/{story_id}/analysis-summary
  Response: StoryAnalysisSummary

  Returns aggregated analysis grouped by issues.
  Used for future grouped UI (built now for later).

POST /api/v1/stories/{story_id}/tasks/suggest
  Request: { use_github: bool }
  Response: { suggestion_id: UUID, status: "processing" }

  Triggers async task suggestion generation.
  If use_github=true, includes GitHub context.

GET /api/v1/stories/{story_id}/task-suggestions
  Response: TaskSuggestion[]

  Returns generated task suggestions.
  User reviews before creating actual tasks.
```

### Individual Task Operations

```
POST /api/v1/tasks/{task_id}/analyze
  Request: {} (empty body)
  Response: TaskAnalysis

  Analyze single task (existing feature, now implemented).
  Returns analysis result immediately.
```

### Project Configuration

```
POST /api/v1/projects/{project_id}/github-config
  Request: { repo_url: string }
  Response: { id: UUID, repo_url: string, validated: bool }

  Configure GitHub repo for a project.
  Validates repo access before saving.

GET /api/v1/projects/{project_id}/github-config
  Response: { repo_url: string, default_branch: string }

  Get current GitHub configuration.
```

### Authentication

- All endpoints require Clerk organization authentication
- GitHub operations use org-level OAuth token
- LLM operations use service-level API keys (from environment)

## Database Schema

### task_analyses (Projection)

```sql
CREATE TABLE task_analyses (
    id UUID PRIMARY KEY,
    task_id UUID NOT NULL,
    story_id UUID NOT NULL,
    organization_id UUID NOT NULL,

    -- Clarity scores (0-100)
    overall_score SMALLINT NOT NULL,
    technical_specificity_score SMALLINT NOT NULL,
    vague_language_score SMALLINT NOT NULL,
    ac_references_score SMALLINT NOT NULL,
    success_criteria_score SMALLINT NOT NULL,
    dependencies_score SMALLINT NOT NULL,
    test_expectations_score SMALLINT NOT NULL,

    -- Analysis details (JSONB for flexibility)
    vague_terms JSONB NOT NULL DEFAULT '[]',
    missing_elements JSONB NOT NULL DEFAULT '[]',
    recommendations JSONB NOT NULL DEFAULT '[]',

    analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_analyses_story ON task_analyses(story_id);
CREATE INDEX idx_task_analyses_task ON task_analyses(task_id);
CREATE INDEX idx_task_analyses_org ON task_analyses(organization_id);
```

### story_analysis_summaries (Projection)

```sql
CREATE TABLE story_analysis_summaries (
    id UUID PRIMARY KEY,
    story_id UUID NOT NULL UNIQUE,
    organization_id UUID NOT NULL,

    total_tasks INT NOT NULL,
    average_clarity_score SMALLINT NOT NULL,

    -- Grouped issues
    -- Format: { "vague_language": ["task_id1", "task_id2"], "missing_acs": [...] }
    issues_by_type JSONB NOT NULL DEFAULT '{}',

    analyzed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_story_summaries_org ON story_analysis_summaries(organization_id);
```

### task_suggestions (Projection)

```sql
CREATE TABLE task_suggestions (
    id UUID PRIMARY KEY,
    story_id UUID NOT NULL,
    organization_id UUID NOT NULL,

    title TEXT NOT NULL,
    description TEXT NOT NULL,
    suggested_files JSONB DEFAULT '[]',
    code_examples JSONB DEFAULT '[]',
    confidence_score SMALLINT NOT NULL,
    ac_refs JSONB DEFAULT '[]',
    estimated_hours NUMERIC(4,1),

    status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_suggestions_story ON task_suggestions(story_id);
CREATE INDEX idx_task_suggestions_org ON task_suggestions(organization_id);
CREATE INDEX idx_task_suggestions_status ON task_suggestions(status);
```

### github_repo_configs (Projection)

```sql
CREATE TABLE github_repo_configs (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL UNIQUE,
    organization_id UUID NOT NULL,

    repo_url TEXT NOT NULL,
    default_branch TEXT DEFAULT 'main',
    last_validated_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_github_configs_org ON github_repo_configs(organization_id);
```

## Frontend Design

### New Components

**1. StoryActionsBar** (`components/story/StoryActionsBar.tsx`)
```tsx
interface StoryActionsBarProps {
  story: Story;
  onSuggestTasks: () => void;
  onAnalyzeTasks: () => void;
}
```

**2. TaskSuggestionsModal** (`components/tasks/TaskSuggestionsModal.tsx`)
```tsx
interface TaskSuggestionsModalProps {
  suggestions: TaskSuggestion[];
  onApprove: (suggestion: TaskSuggestion) => void;
  onReject: (id: string) => void;
  onEdit: (suggestion: TaskSuggestion) => void;
  isOpen: boolean;
  onClose: () => void;
}
```

**3. TaskAnalysisResults** (`components/tasks/TaskAnalysisResults.tsx`)
```tsx
interface TaskAnalysisResultsProps {
  storyId: string;
  analyses: TaskAnalysis[];
}
```

**4. TaskAnalysisCard** (`components/tasks/TaskAnalysisCard.tsx`)
```tsx
interface TaskAnalysisCardProps {
  task: Task;
  analysis: TaskAnalysis;
  onViewDetails: () => void;
}
```

### User Flows

#### Suggest Tasks Flow

1. User navigates to story detail page
2. Clicks **"Suggest Tasks"** button
3. Loading spinner shows → API call `POST /stories/{id}/tasks/suggest`
4. Returns `{ suggestion_id, status: "processing" }`
5. Poll `GET /stories/{id}/task-suggestions` until ready
6. Display **TaskSuggestionsModal** with generated tasks
7. User reviews each suggestion:
   - Edit title/description inline
   - View GitHub context (file paths, code examples)
   - Approve, reject, or edit
8. User clicks **"Create Selected Tasks"**
9. API creates approved tasks in backlog
10. Modal closes, task list refreshes

#### Analyze Tasks Flow

1. User navigates to story detail page
2. Clicks **"Analyze Tasks"** button
3. Loading state overlays task list → API call `POST /stories/{id}/tasks/analyze`
4. Returns `{ analysis_id, status: "processing" }`
5. Poll `GET /stories/{id}/task-analyses` until ready
6. Display **TaskAnalysisResults** component
7. Shows list of **TaskAnalysisCard** components
8. Each card displays:
   - Task title
   - Clarity score with color coding (red/yellow/green)
   - Top 3 recommendations
   - "View Details" button
9. User clicks **"View Details"** → Shows full analysis modal

#### Individual Task Analysis

1. User sees **"Analyze"** button on task card
2. Clicks button → API call `POST /tasks/{id}/analyze`
3. Loading spinner on button
4. Returns TaskAnalysis immediately
5. Display inline or in modal with recommendations

### UI State Management

```typescript
// React Query hooks
const useSuggestTasks = (storyId: string) => {
  // POST /stories/{id}/tasks/suggest
  // Poll GET /stories/{id}/task-suggestions
}

const useAnalyzeTasks = (storyId: string) => {
  // POST /stories/{id}/tasks/analyze
  // Poll GET /stories/{id}/task-analyses
}

const useAnalyzeTask = (taskId: string) => {
  // POST /tasks/{id}/analyze
}
```

## Testing Strategy

### 1. Domain Unit Tests (Pure Logic, No I/O)

**Clarity Scoring:**
- Task with no file paths → low technical_specificity score
- Task with "implement feature" → high vague_language penalty
- Task with AC references → high ac_references score
- Task with "tests required" → high test_expectations score

**Vague Term Detection:**
- Detect "implement", "add", "fix", "create" without context
- Ignore when followed by specific nouns ("add UserService.ts")
- Flag multiple vague terms

**Recommendation Generation:**
- Missing file paths → recommend adding specific files
- No AC references → recommend linking to ACs
- No test mention → recommend test expectations

**Tests:**
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clarity_score_low_when_missing_file_paths() {
        let task = Task {
            title: "Implement feature",
            description: "Add the new feature to the app",
        };

        let score = calculate_clarity_score(&task, &context);

        assert!(score.technical_specificity < 30);
        assert!(score.overall < 50);
    }

    #[test]
    fn test_clarity_score_high_when_well_defined() {
        let task = Task {
            title: "Add UserService.ts with CRUD operations",
            description: "Create src/services/UserService.ts...",
        };

        let score = calculate_clarity_score(&task, &context);

        assert!(score.technical_specificity >= 80);
        assert!(score.overall >= 80);
    }
}
```

### 2. Integration Tests (With Real Dependencies)

**GitHub Client:**
```rust
#[tokio::test]
async fn test_get_repo_structure_returns_file_tree() {
    let client = GitHubClient::new(test_token());

    let structure = client
        .get_repo_structure("https://github.com/test/repo")
        .await
        .unwrap();

    assert!(!structure.files.is_empty());
    assert!(structure.files.iter().any(|f| f.ends_with(".rs")));
}

#[tokio::test]
async fn test_search_code_returns_relevant_results() {
    let client = GitHubClient::new(test_token());

    let results = client
        .search_code("https://github.com/test/repo", "function:main")
        .await
        .unwrap();

    assert!(!results.is_empty());
}
```

**LLM Client (Mock Responses):**
```rust
#[tokio::test]
async fn test_analyze_task_returns_valid_analysis() {
    let client = MockLLMClient::new();

    let analysis = client
        .analyze_task(TaskAnalysisContext { /* ... */ })
        .await
        .unwrap();

    assert!(analysis.clarity_score.overall <= 100);
    assert!(!analysis.recommendations.is_empty());
}
```

**Database Projections:**
```rust
#[sqlx::test]
async fn test_task_analyzed_event_updates_projection(pool: PgPool) {
    let event = TaskAnalyzed { /* ... */ };

    handle_task_analyzed_event(&pool, event).await.unwrap();

    let analysis = sqlx::query_as::<_, TaskAnalysis>(
        "SELECT * FROM task_analyses WHERE task_id = $1"
    )
    .fetch_one(&pool)
    .await
    .unwrap();

    assert_eq!(analysis.task_id, event.task_id);
}
```

### 3. API Contract Tests

```rust
#[tokio::test]
async fn test_analyze_tasks_returns_202_with_id() {
    let app = test_app().await;

    let response = app
        .post("/api/v1/stories/test-story-id/tasks/analyze")
        .send()
        .await;

    assert_eq!(response.status(), StatusCode::ACCEPTED);

    let body: Value = response.json().await;
    assert!(body["analysis_id"].is_string());
    assert_eq!(body["status"], "processing");
}

#[tokio::test]
async fn test_get_task_analyses_returns_array() {
    let app = test_app().await;

    let response = app
        .get("/api/v1/stories/test-story-id/task-analyses")
        .send()
        .await;

    assert_eq!(response.status(), StatusCode::OK);

    let body: Vec<TaskAnalysis> = response.json().await;
    assert!(body.iter().all(|a| a.clarity_score.overall <= 100));
}
```

### 4. E2E Tests (Frontend + Backend)

```typescript
test('User can suggest tasks and create selected ones', async ({ page }) => {
  await page.goto('/projects/{id}/backlog/{story-id}')

  // Click Suggest Tasks
  await page.click('button:has-text("Suggest Tasks")')

  // Wait for modal
  await page.waitForSelector('[data-testid="task-suggestions-modal"]')

  // Should show suggestions
  const suggestions = await page.locator('[data-testid="task-suggestion-card"]').count()
  expect(suggestions).toBeGreaterThan(0)

  // Approve first suggestion
  await page.click('[data-testid="approve-suggestion-0"]')

  // Click Create Selected
  await page.click('button:has-text("Create Selected Tasks")')

  // Should create task
  await page.waitForSelector('text="Task created"')
})

test('User can analyze all tasks in story', async ({ page }) => {
  await page.goto('/projects/{id}/backlog/{story-id}')

  // Click Analyze Tasks
  await page.click('button:has-text("Analyze Tasks")')

  // Wait for analysis results
  await page.waitForSelector('[data-testid="task-analysis-results"]')

  // Should show analysis cards
  const cards = await page.locator('[data-testid="task-analysis-card"]').count()
  expect(cards).toBeGreaterThan(0)

  // Should show clarity scores
  const score = await page.locator('[data-testid="clarity-score"]').first().textContent()
  expect(parseInt(score!)).toBeLessThanOrEqual(100)
})
```

## Implementation Order (TDD)

### Phase 1: Backend Core (services/readiness)

1. **GitHub Client**
   - Write tests for `get_repo_structure`
   - Implement GitHub API client
   - Write tests for `search_code`
   - Implement search functionality
   - Test: Use real GitHub API in CI with test repo

2. **LLM Client**
   - Write tests for `analyze_task` (mocked responses)
   - Implement Anthropic/OpenAI client with fallback
   - Write tests for `suggest_tasks`
   - Implement prompt construction
   - Test: Validate prompt structure and response parsing

3. **Domain Models + Clarity Scoring**
   - Write tests for clarity score calculation
   - Implement scoring algorithm
   - Write tests for vague term detection
   - Implement term detection
   - Write tests for recommendation generation
   - Implement recommendation rules

4. **Database Projections**
   - Create migrations for 4 new tables
   - Write tests for event handlers
   - Implement projection update logic
   - Test: Event → projection flow

### Phase 2: Backend API

1. **HTTP Handlers**
   - Write API contract tests
   - Implement handlers for story-level endpoints
   - Implement handlers for task-level endpoint
   - Test: Status codes, response schemas, error cases

2. **OpenAPI Spec**
   - Update `docs/openapi.yaml` with new endpoints
   - Add request/response schemas
   - Add examples

### Phase 3: Frontend

1. **API Client Functions**
   - Implement React Query hooks
   - Add polling logic for async operations
   - Test: Mock API responses

2. **UI Components**
   - Implement StoryActionsBar
   - Implement TaskSuggestionsModal
   - Implement TaskAnalysisResults
   - Implement TaskAnalysisCard
   - Test: Component rendering, user interactions

3. **Integration with Story Page**
   - Add buttons to story detail page
   - Wire up state management
   - Test: Full user flows

### Phase 4: E2E

1. **Full Workflow Tests**
   - Test: Suggest tasks flow
   - Test: Analyze tasks flow
   - Test: Individual task analysis
   - Run against real backend + database

## Implementation Approach

**TDD Cycle:**
1. Write failing test
2. Implement minimum code to pass
3. Refactor for clarity
4. Commit with passing test suite

**Branch Strategy:**
- Create feature branch: `feature/task-readiness-story-level-features`
- Use git worktree for isolation
- Create PR when complete with all tests passing

**Each Commit:**
- Represents a passing test suite
- Incremental progress toward complete feature
- Clear commit message describing what test passes

## Success Criteria

✅ User can click "Suggest Tasks" on a story
✅ System generates 5-8 task suggestions using story + GitHub context
✅ User can review, edit, and approve suggestions before creating
✅ User can click "Analyze Tasks" on a story
✅ System analyzes all tasks and shows clarity scores
✅ Individual task analysis button works
✅ Clarity scores reflect the 6 criteria accurately
✅ 80+ score = ready for AI agents/junior devs
✅ GitHub integration works with OAuth token
✅ LLM integration has Anthropic → OpenAI fallback
✅ All tests pass (unit, integration, contract, E2E)
✅ OpenAPI spec updated and accurate

## Trade-offs & Future Enhancements

**Current Implementation:**
- Simple list view for task analyses
- Both projections built (individual + summary)
- Frontend uses individual projection

**Future Enhancement:**
- Switch frontend to summary projection
- Show grouped view: "These 4 tasks missing ACs"
- Batch edit functionality

**Why This Approach:**
- Get value in users' hands quickly
- Build infrastructure for future UX
- No backend changes needed later

## Open Questions

None - design validated through collaborative brainstorming.

---

**Ready for Implementation:** Yes
**Next Step:** Create git worktree and detailed implementation plan
