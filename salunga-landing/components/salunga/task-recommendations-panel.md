# Task Recommendations Panel Component

## Overview

The `TaskRecommendationsPanel` component displays categorized recommendations for improving task readiness and clarity. It provides a comprehensive analysis of tasks with actionable suggestions, vague term detection, and missing element highlighting.

## Features

- **Clarity Score Display**: Visual indicator (0-100%) showing how well-defined a task is
- **Categorized Recommendations**: Organized by type (technical details, vague language, AC references, etc.)
- **Expandable Sections**: Collapsible categories for better information hierarchy
- **Severity Indicators**: Color-coded badges (low/medium/high) for prioritization
- **Missing Elements Highlighting**: Clear visual indicators for what's missing
- **Vague Term Detection**: Flags ambiguous language with concrete suggestions
- **Impact Scores**: Shows potential improvement percentage for each recommendation
- **AI Compatibility Check**: Evaluates if task is ready for AI agent execution
- **One-Click Apply**: Quick action buttons to apply recommendations

## Acceptance Criteria Coverage

This component implements the following acceptance criteria:

### ✅ e0261453 - Clarity Score Display
- Shows clarity score (0-100%) with visual indicator
- Provides specific recommendations for improvement
- Uses semantic color coding (poor/fair/good/excellent)

### ✅ 81054dee - Missing Technical Details
- Recommends adding file paths to modify
- Suggests specific functions/components to create/change
- Highlights missing inputs/outputs
- Prompts for technical approach or architecture decisions

### ✅ 30639999 - Vague/Ambiguous Language
- Flags terms like "implement", "create", "build", "add", "fix" without specifics
- Shows context where vague terms appear
- Recommends concrete actions with measurable outcomes

### ✅ 5649e91e - Missing AC References
- Recommends linking to specific acceptance criteria IDs
- Suggests which ACs the task addresses
- Highlights when AC mapping is incomplete

### ✅ 3f42fa09 - AI Agent Compatibility
- Evaluates clear success criteria presence
- Checks for explicit dependencies
- Verifies environment setup requirements
- Assesses test coverage expectations
- Validates definition of done

### ✅ bbd83897 - One-Click Apply
- Shows well-defined task examples
- Provides apply buttons for each recommendation
- Supports AI-assisted task enrichment

## Props

```typescript
interface TaskRecommendationsPanelProps {
  taskId: string                                  // Unique task identifier
  taskDescription: string                         // Task description text
  taskTitle?: string                             // Optional task title for display
  acReferences?: string[]                        // Array of AC IDs this task references
  onRecommendationApply?: (id: string) => void  // Callback when user applies a recommendation
  onEnhanceTask?: () => void                     // Callback for AI enhancement action
  className?: string                             // Additional CSS classes
}
```

## Usage

### Basic Usage

```typescript
import { TaskRecommendationsPanel } from '@/components/salunga/task-recommendations-panel'

function TaskDetailPage() {
  const handleApply = (recommendationId: string) => {
    console.log('Applying recommendation:', recommendationId)
    // Apply the recommendation logic here
  }

  const handleEnhance = () => {
    console.log('Enhancing task with AI')
    // Trigger AI enhancement
  }

  return (
    <TaskRecommendationsPanel
      taskId="task-123"
      taskTitle="Create user authentication flow"
      taskDescription="Implement login and signup functionality"
      acReferences={['ac-001', 'ac-002']}
      onRecommendationApply={handleApply}
      onEnhanceTask={handleEnhance}
    />
  )
}
```

### With API Integration

```typescript
import { TaskRecommendationsPanel } from '@/components/salunga/task-recommendations-panel'
import { useState, useEffect } from 'react'

function TaskAnalysisView({ taskId }: { taskId: string }) {
  const [task, setTask] = useState(null)

  useEffect(() => {
    // Fetch task data from API
    fetch(`/api/tasks/${taskId}`)
      .then(res => res.json())
      .then(setTask)
  }, [taskId])

  const handleApplyRecommendation = async (recommendationId: string) => {
    await fetch(`/api/tasks/${taskId}/apply-recommendation`, {
      method: 'POST',
      body: JSON.stringify({ recommendationId })
    })
    // Refresh task data
  }

  if (!task) return <div>Loading...</div>

  return (
    <TaskRecommendationsPanel
      taskId={task.id}
      taskTitle={task.title}
      taskDescription={task.description}
      acReferences={task.acceptanceCriteriaRefs}
      onRecommendationApply={handleApplyRecommendation}
    />
  )
}
```

## Component Structure

### Clarity Score Display
- Circular progress indicator
- Numerical score (0-100%)
- Categorical level (Poor/Fair/Good/Excellent)
- Color-coded based on score threshold

### Recommendation Categories
- **Missing Technical Details**: File paths, functions, architecture
- **Vague Language**: Ambiguous terms requiring clarification
- **Missing AC References**: Unlinked acceptance criteria
- **Missing Success Criteria**: Unclear completion conditions
- **Missing Dependencies**: Unspecified task dependencies
- **Missing Environment Setup**: Configuration requirements
- **Missing Test Coverage**: Testing expectations
- **Missing Definition of Done**: Completion criteria

### AI Compatibility Checklist
- ✅/❌ Clear Success Criteria
- ✅/❌ Explicit Dependencies
- ✅/❌ Environment Setup
- ✅/❌ Test Coverage Expectations
- ✅/❌ Definition of Done

## Styling

The component uses the Salunga design system:

- **Colors**: Semantic colors for severity levels
  - `salunga-success`: Low severity / passed checks
  - `salunga-warning`: Medium severity
  - `salunga-danger`: High severity / failed checks
  - `salunga-primary`: Primary actions
  - `salunga-accent`: AI features

- **Spacing**: Consistent spacing tokens
  - Card padding: `p-4`
  - Section gaps: `space-y-3`, `space-y-4`

- **Border Radius**: Rounded corners
  - Cards: `rounded-salunga-xl`
  - Buttons: `rounded-salunga-md`
  - Highlights: `rounded-salunga-lg`

- **Shadows**: Elevation on hover
  - Default: `shadow-salunga-sm`
  - Hover: `hover:shadow-salunga-md`

## Accessibility

- **Keyboard Navigation**: All interactive elements are keyboard accessible
- **ARIA Labels**: Proper data-testid attributes for testing
- **Color Contrast**: WCAG AA compliant color combinations
- **Focus Indicators**: Visible focus states on all buttons
- **Screen Readers**: Semantic HTML with proper heading hierarchy

## Testing

### E2E Tests (Playwright)

Located in: `/tests/task-recommendations-panel.spec.ts`

Key test scenarios:
- Clarity score display
- Category expansion/collapse
- Severity badge rendering
- Vague term highlighting
- Missing element detection
- One-click apply functionality
- Responsive layout on mobile
- Screenshot regression tests

Run tests:
```bash
npm run test:e2e
```

### Visual Regression

Screenshots are captured for:
- Default state with recommendations
- Expanded categories
- Empty state (well-defined task)
- Mobile responsive view

## Performance Considerations

- **Lazy Expansion**: Categories render content only when expanded
- **Memoized Calculations**: Uses `useMemo` for categorization logic
- **Optimized Re-renders**: State updates are isolated to minimize re-renders

## Future Enhancements

- [ ] Real-time analysis via WebSocket
- [ ] Recommendation history tracking
- [ ] Batch apply for multiple recommendations
- [ ] Custom recommendation templates
- [ ] Export analysis reports
- [ ] Integration with task editing UI

## Related Components

- `SalungaCard` - Card layout primitives
- `SalungaBadge` - Severity indicators
- `KanbanColumn` - Task display patterns

## API Integration

Expected backend endpoints:

```
POST /api/tasks/{taskId}/analyze
  → Returns: { clarityScore, recommendations[], vagueterms[], missingElements[] }

POST /api/tasks/{taskId}/apply-recommendation
  Body: { recommendationId: string }
  → Applies recommendation and returns updated task

POST /api/tasks/{taskId}/enhance
  → Triggers AI enhancement and returns enriched task description
```

## Examples

See `TaskRecommendationsPanelShowcase` component in the same file for a complete working example, or visit `/brand` page to see it in action.

## License

Part of the Battra AI Salunga design system.
