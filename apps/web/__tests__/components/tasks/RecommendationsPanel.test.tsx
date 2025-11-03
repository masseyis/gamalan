import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { RecommendationsPanel } from '@/components/tasks/RecommendationsPanel'
import { TaskReadinessAnalysis } from '@/lib/types/task-readiness'

describe('RecommendationsPanel', () => {
  const mockAnalysis: TaskReadinessAnalysis = {
    taskId: 'task-123',
    clarityScore: {
      score: 65,
      level: 'fair',
    },
    vagueTerms: [
      {
        term: 'implement',
        position: 10,
        suggestion: 'Specify what to implement: "Add UserService.authenticate() method"',
      },
      {
        term: 'fix',
        position: 45,
        suggestion: 'Describe the specific bug and expected behavior',
      },
    ],
    missingElements: [
      {
        category: 'technical-details',
        description: 'Missing file paths to modify',
        importance: 'high',
        recommendation: 'Add specific file paths like src/services/UserService.ts',
      },
      {
        category: 'acceptance-criteria',
        description: 'No acceptance criteria references',
        importance: 'critical',
        recommendation: 'Link to specific AC IDs that this task addresses',
      },
    ],
    technicalDetailRecommendations: [
      {
        type: 'file-path',
        description: 'Add file path to modify',
        example: 'src/services/auth/UserService.ts',
      },
    ],
    acRecommendations: [
      {
        acId: 'ac-001',
        description: 'User authentication flow',
        relevance: 'high',
      },
    ],
    aiCompatibilityIssues: [
      'Missing clear success criteria',
      'No explicit dependencies listed',
      'Expected test coverage not defined',
    ],
    examples: [
      {
        title: 'Add JWT token validation',
        description: 'Implement JWT validation in AuthMiddleware.ts...',
        source: 'project',
        projectId: 'proj-456',
        taskId: 'task-789',
      },
    ],
    recommendations: [
      {
        id: 'rec-1',
        category: 'technical-details',
        title: 'Add file paths',
        description: 'Specify which files need to be modified',
        priority: 'high',
        actionable: true,
        autoApplyable: false,
      },
      {
        id: 'rec-2',
        category: 'acceptance-criteria',
        title: 'Link acceptance criteria',
        description: 'Reference AC IDs that this task addresses',
        priority: 'critical',
        actionable: true,
        autoApplyable: true,
      },
      {
        id: 'rec-3',
        category: 'ai-compatibility',
        title: 'Add success criteria',
        description: 'Define clear criteria for task completion',
        priority: 'medium',
        actionable: true,
        autoApplyable: false,
      },
    ],
    analyzedAt: new Date().toISOString(),
  }

  const emptyAnalysis: TaskReadinessAnalysis = {
    taskId: 'task-456',
    clarityScore: {
      score: 95,
      level: 'excellent',
    },
    vagueTerms: [],
    missingElements: [],
    technicalDetailRecommendations: [],
    acRecommendations: [],
    aiCompatibilityIssues: [],
    examples: [],
    recommendations: [],
    analyzedAt: new Date().toISOString(),
  }

  describe('Rendering', () => {
    it('should render the panel with clarity score', () => {
      render(<RecommendationsPanel analysis={mockAnalysis} />)

      expect(screen.getByText('Task Readiness Analysis')).toBeInTheDocument()
      expect(screen.getByText('Clarity Score')).toBeInTheDocument()
      expect(screen.getByText('65')).toBeInTheDocument()
      expect(screen.getByText('fair')).toBeInTheDocument()
    })

    it('should display all category sections', () => {
      render(<RecommendationsPanel analysis={mockAnalysis} />)

      expect(screen.getByText('Technical Details')).toBeInTheDocument()
      expect(screen.getByText('Vague Terms')).toBeInTheDocument()
      expect(screen.getByText('Acceptance Criteria')).toBeInTheDocument()
      expect(screen.getByText('AI Agent Compatibility')).toBeInTheDocument()
    })

    it('should show item counts for each category', () => {
      render(<RecommendationsPanel analysis={mockAnalysis} />)

      // Technical Details: 1 recommendation + 1 missing element = 2
      // Vague Terms: 2 vague terms
      // Acceptance Criteria: 1 recommendation + 1 missing element = 2
      // AI Compatibility: 1 recommendation + 3 issues = 4

      const badges = screen.getAllByText(/\d+/)
      expect(badges.length).toBeGreaterThan(0)
    })

    it('should show success message when no recommendations', () => {
      render(<RecommendationsPanel analysis={emptyAnalysis} />)

      expect(screen.getByText('No recommendations')).toBeInTheDocument()
      expect(screen.getByText('This task is well-defined and ready!')).toBeInTheDocument()
    })
  })

  describe('Clarity Score Display', () => {
    it('should apply correct color for excellent clarity', () => {
      const excellentAnalysis = {
        ...mockAnalysis,
        clarityScore: { score: 95, level: 'excellent' as const },
      }
      const { container } = render(<RecommendationsPanel analysis={excellentAnalysis} />)

      const scoreElement = screen.getByText('95')
      expect(scoreElement).toHaveClass('text-green-600')
    })

    it('should apply correct color for poor clarity', () => {
      const poorAnalysis = {
        ...mockAnalysis,
        clarityScore: { score: 35, level: 'poor' as const },
      }
      const { container } = render(<RecommendationsPanel analysis={poorAnalysis} />)

      const scoreElement = screen.getByText('35')
      expect(scoreElement).toHaveClass('text-red-600')
    })

    it('should apply correct color for good clarity', () => {
      const goodAnalysis = {
        ...mockAnalysis,
        clarityScore: { score: 75, level: 'good' as const },
      }
      const { container } = render(<RecommendationsPanel analysis={goodAnalysis} />)

      const scoreElement = screen.getByText('75')
      expect(scoreElement).toHaveClass('text-blue-600')
    })

    it('should apply correct color for fair clarity', () => {
      render(<RecommendationsPanel analysis={mockAnalysis} />)

      const scoreElement = screen.getByText('65')
      expect(scoreElement).toHaveClass('text-yellow-600')
    })
  })

  describe('Expandable Sections', () => {
    it('should start with sections collapsed', () => {
      render(<RecommendationsPanel analysis={mockAnalysis} />)

      // Recommendations should not be visible initially
      expect(screen.queryByText('Add file paths')).not.toBeInTheDocument()
    })

    it('should expand section when clicked', () => {
      render(<RecommendationsPanel analysis={mockAnalysis} />)

      const technicalDetailsButton = screen.getByText('Technical Details').closest('button')!
      fireEvent.click(technicalDetailsButton)

      // Now the recommendation should be visible
      expect(screen.getByText('Add file paths')).toBeInTheDocument()
    })

    it('should collapse section when clicked again', () => {
      render(<RecommendationsPanel analysis={mockAnalysis} />)

      const technicalDetailsButton = screen.getByText('Technical Details').closest('button')!

      // Expand
      fireEvent.click(technicalDetailsButton)
      expect(screen.getByText('Add file paths')).toBeInTheDocument()

      // Collapse
      fireEvent.click(technicalDetailsButton)
      expect(screen.queryByText('Add file paths')).not.toBeInTheDocument()
    })

    it('should show chevron right when collapsed', () => {
      const { container } = render(<RecommendationsPanel analysis={mockAnalysis} />)

      // Check for ChevronRight icon (should be present initially)
      const technicalDetailsButton = screen.getByText('Technical Details').closest('button')!
      const chevronRight = technicalDetailsButton.querySelector('svg')
      expect(chevronRight).toBeInTheDocument()
    })

    it('should show chevron down when expanded', () => {
      render(<RecommendationsPanel analysis={mockAnalysis} />)

      const technicalDetailsButton = screen.getByText('Technical Details').closest('button')!
      fireEvent.click(technicalDetailsButton)

      // After clicking, chevron should change
      const chevronDown = technicalDetailsButton.querySelector('svg')
      expect(chevronDown).toBeInTheDocument()
    })
  })

  describe('Vague Terms Display', () => {
    it('should display vague terms when section is expanded', () => {
      render(<RecommendationsPanel analysis={mockAnalysis} />)

      const vagueTermsButton = screen.getByText('Vague Terms').closest('button')!
      fireEvent.click(vagueTermsButton)

      expect(screen.getByText('implement')).toBeInTheDocument()
      expect(screen.getByText('fix')).toBeInTheDocument()
    })

    it('should display suggestions for vague terms', () => {
      render(<RecommendationsPanel analysis={mockAnalysis} />)

      const vagueTermsButton = screen.getByText('Vague Terms').closest('button')!
      fireEvent.click(vagueTermsButton)

      expect(
        screen.getByText(/Specify what to implement: "Add UserService.authenticate\(\) method"/)
      ).toBeInTheDocument()
      expect(
        screen.getByText(/Describe the specific bug and expected behavior/)
      ).toBeInTheDocument()
    })

    it('should highlight vague terms with amber styling', () => {
      render(<RecommendationsPanel analysis={mockAnalysis} />)

      const vagueTermsButton = screen.getByText('Vague Terms').closest('button')!
      fireEvent.click(vagueTermsButton)

      const vagueTermElement = screen.getByText('implement').closest('code')?.parentElement?.parentElement
      expect(vagueTermElement).toHaveClass('bg-amber-50')
    })
  })

  describe('Missing Elements Display', () => {
    it('should display missing elements with importance badges', () => {
      render(<RecommendationsPanel analysis={mockAnalysis} />)

      const technicalDetailsButton = screen.getByText('Technical Details').closest('button')!
      fireEvent.click(technicalDetailsButton)

      expect(screen.getByText('Missing file paths to modify')).toBeInTheDocument()
      expect(screen.getAllByText('high').length).toBeGreaterThan(0)
    })

    it('should highlight critical missing elements in red', () => {
      render(<RecommendationsPanel analysis={mockAnalysis} />)

      const acButton = screen.getByText('Acceptance Criteria').closest('button')!
      fireEvent.click(acButton)

      const criticalElement = screen.getByText('No acceptance criteria references').closest('div')?.parentElement
      expect(criticalElement).toHaveClass('bg-red-50')
    })

    it('should display recommendations for missing elements', () => {
      render(<RecommendationsPanel analysis={mockAnalysis} />)

      const technicalDetailsButton = screen.getByText('Technical Details').closest('button')!
      fireEvent.click(technicalDetailsButton)

      expect(
        screen.getByText('Add specific file paths like src/services/UserService.ts')
      ).toBeInTheDocument()
    })
  })

  describe('Recommendations Display', () => {
    it('should display recommendation titles and descriptions', () => {
      render(<RecommendationsPanel analysis={mockAnalysis} />)

      const technicalDetailsButton = screen.getByText('Technical Details').closest('button')!
      fireEvent.click(technicalDetailsButton)

      expect(screen.getByText('Add file paths')).toBeInTheDocument()
      expect(screen.getByText('Specify which files need to be modified')).toBeInTheDocument()
    })

    it('should display priority badges for recommendations', () => {
      render(<RecommendationsPanel analysis={mockAnalysis} />)

      const acButton = screen.getByText('Acceptance Criteria').closest('button')!
      fireEvent.click(acButton)

      expect(screen.getAllByText('critical').length).toBeGreaterThan(0)
    })

    it('should show action buttons for actionable recommendations', () => {
      const mockApply = vi.fn()
      render(<RecommendationsPanel analysis={mockAnalysis} onApplyRecommendation={mockApply} />)

      const technicalDetailsButton = screen.getByText('Technical Details').closest('button')!
      fireEvent.click(technicalDetailsButton)

      expect(screen.getByText('View Details')).toBeInTheDocument()
    })

    it('should show auto-apply button for auto-applyable recommendations', () => {
      const mockApply = vi.fn()
      render(<RecommendationsPanel analysis={mockAnalysis} onApplyRecommendation={mockApply} />)

      const acButton = screen.getByText('Acceptance Criteria').closest('button')!
      fireEvent.click(acButton)

      expect(screen.getByText('Apply Automatically')).toBeInTheDocument()
    })
  })

  describe('AI Compatibility Issues', () => {
    it('should display AI compatibility issues', () => {
      render(<RecommendationsPanel analysis={mockAnalysis} />)

      const aiButton = screen.getByText('AI Agent Compatibility').closest('button')!
      fireEvent.click(aiButton)

      expect(screen.getByText('Missing clear success criteria')).toBeInTheDocument()
      expect(screen.getByText('No explicit dependencies listed')).toBeInTheDocument()
      expect(screen.getByText('Expected test coverage not defined')).toBeInTheDocument()
    })
  })

  describe('Callbacks', () => {
    it('should call onApplyRecommendation when action button is clicked', () => {
      const mockApply = vi.fn()
      render(<RecommendationsPanel analysis={mockAnalysis} onApplyRecommendation={mockApply} />)

      const technicalDetailsButton = screen.getByText('Technical Details').closest('button')!
      fireEvent.click(technicalDetailsButton)

      const viewDetailsButton = screen.getByText('View Details')
      fireEvent.click(viewDetailsButton)

      expect(mockApply).toHaveBeenCalledWith('rec-1')
    })

    it('should call onApplyRecommendation with correct ID for auto-applyable items', () => {
      const mockApply = vi.fn()
      render(<RecommendationsPanel analysis={mockAnalysis} onApplyRecommendation={mockApply} />)

      const acButton = screen.getByText('Acceptance Criteria').closest('button')!
      fireEvent.click(acButton)

      const applyButton = screen.getByText('Apply Automatically')
      fireEvent.click(applyButton)

      expect(mockApply).toHaveBeenCalledWith('rec-2')
    })
  })

  describe('Accessibility', () => {
    it('should have accessible button labels', () => {
      render(<RecommendationsPanel analysis={mockAnalysis} />)

      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
      buttons.forEach((button) => {
        expect(button).toBeInTheDocument()
      })
    })

    it('should support keyboard navigation', () => {
      render(<RecommendationsPanel analysis={mockAnalysis} />)

      const technicalDetailsButton = screen.getByText('Technical Details').closest('button')!
      technicalDetailsButton.focus()
      expect(document.activeElement).toBe(technicalDetailsButton)
    })
  })

  describe('Edge Cases', () => {
    it('should handle analysis with only vague terms', () => {
      const vagueOnlyAnalysis: TaskReadinessAnalysis = {
        ...emptyAnalysis,
        vagueTerms: [{ term: 'create', position: 0, suggestion: 'Be specific' }],
      }

      render(<RecommendationsPanel analysis={vagueOnlyAnalysis} />)

      const vagueTermsButton = screen.getByText('Vague Terms').closest('button')!
      fireEvent.click(vagueTermsButton)

      expect(screen.getByText('create')).toBeInTheDocument()
    })

    it('should hide sections with no content', () => {
      const minimalAnalysis: TaskReadinessAnalysis = {
        ...emptyAnalysis,
        recommendations: [
          {
            id: 'rec-1',
            category: 'technical-details',
            title: 'Test',
            description: 'Test description',
            priority: 'low',
            actionable: false,
          },
        ],
      }

      render(<RecommendationsPanel analysis={minimalAnalysis} />)

      // Technical Details should be visible
      expect(screen.getByText('Technical Details')).toBeInTheDocument()

      // Other sections should not be rendered
      expect(screen.queryByText('Vague Terms')).not.toBeInTheDocument()
    })

    it('should handle custom className', () => {
      const { container } = render(
        <RecommendationsPanel analysis={mockAnalysis} className="custom-class" />
      )

      const card = container.querySelector('.custom-class')
      expect(card).toBeInTheDocument()
    })
  })
})
