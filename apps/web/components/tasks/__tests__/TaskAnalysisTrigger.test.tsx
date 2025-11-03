import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TaskAnalysisTrigger } from '../TaskAnalysisTrigger'
import { backlogApi } from '@/lib/api/backlog'
import { TaskReadinessAnalysis } from '@/lib/types/task-readiness'

// Mock the backlog API
vi.mock('@/lib/api/backlog', () => ({
  backlogApi: {
    analyzeTaskReadiness: vi.fn(),
  },
}))

describe('TaskAnalysisTrigger', () => {
  const mockProps = {
    taskId: 'task-123',
    storyId: 'story-456',
    projectId: 'project-789',
  }

  const mockAnalysis: TaskReadinessAnalysis = {
    taskId: 'task-123',
    clarityScore: {
      score: 45,
      level: 'fair',
    },
    vagueTerms: [
      {
        term: 'implement',
        position: 0,
        suggestion: 'Specify exact function names',
      },
    ],
    missingElements: [
      {
        category: 'technical-details',
        description: 'File paths to modify',
        importance: 'high',
        recommendation: 'Specify which files need changes',
      },
    ],
    technicalDetailRecommendations: [],
    acRecommendations: [],
    aiCompatibilityIssues: [],
    examples: [],
    recommendations: [
      {
        id: '1',
        category: 'technical-details',
        title: 'Add file paths',
        description: 'Specify which files to modify',
        priority: 'high',
        actionable: true,
      },
    ],
    analyzedAt: new Date().toISOString(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial Render', () => {
    it('should render analyze button', () => {
      render(<TaskAnalysisTrigger {...mockProps} />)

      expect(screen.getByTestId('analyze-task-button')).toBeInTheDocument()
      expect(screen.getByText('Analyze Task')).toBeInTheDocument()
    })

    it('should render component title and description', () => {
      render(<TaskAnalysisTrigger {...mockProps} />)

      expect(screen.getByText('Task Readiness Analysis')).toBeInTheDocument()
      expect(
        screen.getByText('Analyze this task for clarity and AI-agent compatibility')
      ).toBeInTheDocument()
    })

    it('should not show clarity score badge initially', () => {
      render(<TaskAnalysisTrigger {...mockProps} />)

      expect(screen.queryByTestId('clarity-score-badge')).not.toBeInTheDocument()
    })

    it('should not show recommendations panel initially', () => {
      render(<TaskAnalysisTrigger {...mockProps} />)

      expect(screen.queryByTestId('recommendations-panel')).not.toBeInTheDocument()
    })
  })

  describe('Loading State', () => {
    it('should show loading state when analyzing', async () => {
      vi.mocked(backlogApi.analyzeTaskReadiness).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockAnalysis), 100))
      )

      render(<TaskAnalysisTrigger {...mockProps} />)

      const button = screen.getByTestId('analyze-task-button')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText('Analyzing...')).toBeInTheDocument()
      })

      expect(button).toBeDisabled()
    })

    it('should show loading spinner during analysis', async () => {
      vi.mocked(backlogApi.analyzeTaskReadiness).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockAnalysis), 100))
      )

      render(<TaskAnalysisTrigger {...mockProps} />)

      fireEvent.click(screen.getByTestId('analyze-task-button'))

      await waitFor(() => {
        const loadingSpinner = document.querySelector('.animate-spin')
        expect(loadingSpinner).toBeInTheDocument()
      })
    })
  })

  describe('Clarity Score Display', () => {
    it('should display clarity score after analysis', async () => {
      vi.mocked(backlogApi.analyzeTaskReadiness).mockResolvedValue(mockAnalysis)

      render(<TaskAnalysisTrigger {...mockProps} />)

      fireEvent.click(screen.getByTestId('analyze-task-button'))

      await waitFor(() => {
        expect(screen.getByTestId('clarity-score-badge')).toBeInTheDocument()
      })

      const badge = screen.getByTestId('clarity-score-badge')
      expect(badge).toHaveTextContent('45/100')
      expect(badge).toHaveTextContent('Clarity Score')
    })

    it('should show red color for score < 40', async () => {
      const lowScoreAnalysis = {
        ...mockAnalysis,
        clarityScore: { score: 30, level: 'poor' as const },
      }
      vi.mocked(backlogApi.analyzeTaskReadiness).mockResolvedValue(lowScoreAnalysis)

      render(<TaskAnalysisTrigger {...mockProps} />)

      fireEvent.click(screen.getByTestId('analyze-task-button'))

      await waitFor(() => {
        const badge = screen.getByTestId('clarity-score-badge')
        expect(badge.querySelector('.bg-red-100')).toBeInTheDocument()
      })
    })

    it('should show yellow color for score 40-70', async () => {
      const mediumScoreAnalysis = {
        ...mockAnalysis,
        clarityScore: { score: 55, level: 'fair' as const },
      }
      vi.mocked(backlogApi.analyzeTaskReadiness).mockResolvedValue(mediumScoreAnalysis)

      render(<TaskAnalysisTrigger {...mockProps} />)

      fireEvent.click(screen.getByTestId('analyze-task-button'))

      await waitFor(() => {
        const badge = screen.getByTestId('clarity-score-badge')
        expect(badge.querySelector('.bg-yellow-100')).toBeInTheDocument()
      })
    })

    it('should show green color for score > 70', async () => {
      const highScoreAnalysis = {
        ...mockAnalysis,
        clarityScore: { score: 85, level: 'excellent' as const },
      }
      vi.mocked(backlogApi.analyzeTaskReadiness).mockResolvedValue(highScoreAnalysis)

      render(<TaskAnalysisTrigger {...mockProps} />)

      fireEvent.click(screen.getByTestId('analyze-task-button'))

      await waitFor(() => {
        const badge = screen.getByTestId('clarity-score-badge')
        expect(badge.querySelector('.bg-green-100')).toBeInTheDocument()
      })
    })
  })

  describe('Recommendations Panel', () => {
    it('should show recommendations panel after successful analysis', async () => {
      vi.mocked(backlogApi.analyzeTaskReadiness).mockResolvedValue(mockAnalysis)

      render(<TaskAnalysisTrigger {...mockProps} />)

      fireEvent.click(screen.getByTestId('analyze-task-button'))

      await waitFor(() => {
        expect(screen.getByTestId('recommendations-panel')).toBeInTheDocument()
      })
    })

    it('should not show recommendations panel during analysis', async () => {
      vi.mocked(backlogApi.analyzeTaskReadiness).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockAnalysis), 100))
      )

      render(<TaskAnalysisTrigger {...mockProps} />)

      fireEvent.click(screen.getByTestId('analyze-task-button'))

      // Panel should not be visible immediately during loading
      expect(screen.queryByTestId('recommendations-panel')).not.toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should show error message when analysis fails', async () => {
      const errorMessage = 'Network error'
      vi.mocked(backlogApi.analyzeTaskReadiness).mockRejectedValue(new Error(errorMessage))

      render(<TaskAnalysisTrigger {...mockProps} />)

      fireEvent.click(screen.getByTestId('analyze-task-button'))

      await waitFor(() => {
        expect(screen.getByTestId('analysis-error')).toBeInTheDocument()
      })

      expect(screen.getByText('Analysis Failed')).toBeInTheDocument()
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })

    it('should allow retry after error', async () => {
      vi.mocked(backlogApi.analyzeTaskReadiness)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockAnalysis)

      render(<TaskAnalysisTrigger {...mockProps} />)

      const button = screen.getByTestId('analyze-task-button')

      // First attempt fails
      fireEvent.click(button)
      await waitFor(() => {
        expect(screen.getByTestId('analysis-error')).toBeInTheDocument()
      })

      // Second attempt succeeds
      fireEvent.click(button)
      await waitFor(() => {
        expect(screen.queryByTestId('analysis-error')).not.toBeInTheDocument()
        expect(screen.getByTestId('clarity-score-badge')).toBeInTheDocument()
      })
    })

    it('should clear previous error when starting new analysis', async () => {
      vi.mocked(backlogApi.analyzeTaskReadiness)
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce(mockAnalysis)

      render(<TaskAnalysisTrigger {...mockProps} />)

      const button = screen.getByTestId('analyze-task-button')

      // First attempt fails
      fireEvent.click(button)
      await waitFor(() => {
        expect(screen.getByTestId('analysis-error')).toBeInTheDocument()
      })

      // Start new analysis - error should clear immediately
      fireEvent.click(button)
      expect(screen.queryByTestId('analysis-error')).not.toBeInTheDocument()
    })
  })

  describe('Callback Handling', () => {
    it('should call onAnalysisComplete callback with results', async () => {
      vi.mocked(backlogApi.analyzeTaskReadiness).mockResolvedValue(mockAnalysis)
      const onAnalysisComplete = vi.fn()

      render(<TaskAnalysisTrigger {...mockProps} onAnalysisComplete={onAnalysisComplete} />)

      fireEvent.click(screen.getByTestId('analyze-task-button'))

      await waitFor(() => {
        expect(onAnalysisComplete).toHaveBeenCalledWith(mockAnalysis)
      })
    })

    it('should not call onAnalysisComplete on error', async () => {
      vi.mocked(backlogApi.analyzeTaskReadiness).mockRejectedValue(new Error('Error'))
      const onAnalysisComplete = vi.fn()

      render(<TaskAnalysisTrigger {...mockProps} onAnalysisComplete={onAnalysisComplete} />)

      fireEvent.click(screen.getByTestId('analyze-task-button'))

      await waitFor(() => {
        expect(screen.getByTestId('analysis-error')).toBeInTheDocument()
      })

      expect(onAnalysisComplete).not.toHaveBeenCalled()
    })
  })

  describe('API Integration', () => {
    it('should call API with correct parameters', async () => {
      vi.mocked(backlogApi.analyzeTaskReadiness).mockResolvedValue(mockAnalysis)

      render(<TaskAnalysisTrigger {...mockProps} />)

      fireEvent.click(screen.getByTestId('analyze-task-button'))

      await waitFor(() => {
        expect(backlogApi.analyzeTaskReadiness).toHaveBeenCalledWith(
          mockProps.projectId,
          mockProps.storyId,
          mockProps.taskId
        )
      })
    })
  })

  describe('Accessibility', () => {
    it('should have accessible button text during analysis', async () => {
      vi.mocked(backlogApi.analyzeTaskReadiness).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockAnalysis), 100))
      )

      render(<TaskAnalysisTrigger {...mockProps} />)

      const button = screen.getByTestId('analyze-task-button')
      fireEvent.click(button)

      await waitFor(() => {
        expect(button).toHaveTextContent('Analyzing...')
      })
    })

    it('should disable button during analysis', async () => {
      vi.mocked(backlogApi.analyzeTaskReadiness).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockAnalysis), 100))
      )

      render(<TaskAnalysisTrigger {...mockProps} />)

      const button = screen.getByTestId('analyze-task-button')
      fireEvent.click(button)

      await waitFor(() => {
        expect(button).toBeDisabled()
      })
    })
  })
})
