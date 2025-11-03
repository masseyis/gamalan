# Task Components

This directory contains React components for task management features in the Battra AI platform.

## Components

### RecommendationsPanel

A comprehensive component for displaying task readiness analysis and recommendations.

**Location:** `RecommendationsPanel.tsx`

**Purpose:** Display categorized recommendations to help improve task clarity and AI agent compatibility.

#### Features

- **Clarity Score Display**: Shows a 0-100 score with color-coded quality levels (poor, fair, good, excellent)
- **Categorized Recommendations**: Organizes recommendations into 5 categories:
  - Technical Details (file paths, functions, architecture decisions)
  - Vague Terms (ambiguous language flagging)
  - Acceptance Criteria (AC references and linkage)
  - AI Agent Compatibility (requirements for autonomous execution)
  - Well-Defined Examples (reference implementations)
- **Expandable Sections**: Click to expand/collapse each recommendation category
- **Priority-Based Highlighting**: Visual indicators for critical, high, medium, and low priority items
- **Missing Elements Highlighting**: Red/amber backgrounds for critical missing components
- **Vague Term Flagging**: Special highlighting for ambiguous language with suggestions
- **Actionable Recommendations**: Optional callback for applying recommendations

#### Usage

```tsx
import { RecommendationsPanel } from '@/components/tasks/RecommendationsPanel'
import { TaskReadinessAnalysis } from '@/lib/types/task-readiness'

function TaskDetailPage({ taskId }: { taskId: string }) {
  const [analysis, setAnalysis] = useState<TaskReadinessAnalysis | null>(null)

  // Fetch analysis from API
  useEffect(() => {
    fetchTaskAnalysis(taskId).then(setAnalysis)
  }, [taskId])

  const handleApplyRecommendation = (recommendationId: string) => {
    // Apply the recommendation
    console.log('Applying recommendation:', recommendationId)
  }

  if (!analysis) return <div>Loading...</div>

  return (
    <RecommendationsPanel
      analysis={analysis}
      onApplyRecommendation={handleApplyRecommendation}
      className="mt-4"
    />
  )
}
```

#### Props

```typescript
interface RecommendationsPanelProps {
  analysis: TaskReadinessAnalysis          // Required: The analysis data
  onApplyRecommendation?: (id: string) => void  // Optional: Callback when user clicks apply
  className?: string                        // Optional: Additional CSS classes
}
```

#### Acceptance Criteria Coverage

This component addresses the following acceptance criteria:

- **AC: e0261453** - Displays clarity score with specific recommendations
- **AC: 81054dee** - Shows recommendations for missing technical details
- **AC: 30639999** - Flags vague/ambiguous language with suggestions
- **AC: 5649e91e** - Recommends linking acceptance criteria IDs
- **AC: 3f42fa09** - Evaluates AI agent compatibility requirements
- **AC: bbd83897** - Shows well-defined task examples

#### Visual Design

**Clarity Score Colors:**
- Excellent (90-100): Green
- Good (70-89): Blue
- Fair (50-69): Yellow
- Poor (0-49): Red

**Priority Badge Colors:**
- Critical: Red background
- High: Orange background
- Medium: Yellow background
- Low: Blue background

**Section Highlights:**
- Critical Missing Elements: Red background (bg-red-50)
- High Priority Missing: Red background (bg-red-50)
- Medium/Low Missing: Yellow background (bg-yellow-50)
- Vague Terms: Amber background (bg-amber-50)
- AI Issues: Purple background (bg-purple-50)

#### Example Files

See `RecommendationsPanel.example.tsx` for complete usage examples:
- `ExcellentTaskExample` - Well-defined task with no issues
- `NeedsImprovementTaskExample` - Task requiring significant improvements
- `FairTaskExample` - Task with some improvements needed

#### Tests

Comprehensive test suite in `__tests__/components/tasks/RecommendationsPanel.test.tsx`:
- ✅ 31 passing tests
- Coverage includes:
  - Rendering and layout
  - Clarity score display with color coding
  - Expandable section behavior
  - Vague term highlighting
  - Missing element display
  - Recommendation badges and actions
  - AI compatibility issues
  - Callback functionality
  - Accessibility
  - Edge cases

Run tests:
```bash
npm test -- __tests__/components/tasks/RecommendationsPanel.test.tsx
```

#### Type Definitions

The component uses types from `@/lib/types/task-readiness.ts`:
- `TaskReadinessAnalysis` - Complete analysis structure
- `ClarityScore` - Score and level data
- `VagueTerm` - Flagged ambiguous terms
- `MissingElement` - Required but absent elements
- `Recommendation` - Individual recommendation items
- `RecommendationCategory` - Category enumeration

#### Dependencies

- `lucide-react` - Icons (ChevronDown, ChevronRight, AlertCircle, etc.)
- `@/components/ui/card` - Card layout components
- `@/components/ui/badge` - Priority badges
- `@/components/ui/button` - Action buttons
- `@/lib/utils/cn` - Class name utility

#### Architecture

Follows Battra AI frontend patterns:
- **Client component** (`'use client'` directive)
- **Functional components** with TypeScript
- **Hooks** for state management (useState)
- **Tailwind CSS** for styling
- **shadcn/ui** component library
- **Test-driven development** with comprehensive test coverage

#### Future Enhancements

Potential improvements for future iterations:
- Animation transitions for expand/collapse
- Bulk apply for multiple recommendations
- Export recommendations to markdown/PDF
- Recommendation history tracking
- Integration with AI enrichment suggestions
- Keyboard shortcuts for navigation
- Drag-to-reorder recommendations by priority

## Other Components

### TaskOwnership

(Documentation to be added)

## Contributing

When adding new task components:
1. Create component file with TypeScript types
2. Write comprehensive tests (target 85%+ coverage)
3. Add usage examples
4. Document props and behavior
5. Follow existing patterns and architecture
6. Update this README
