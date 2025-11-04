import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SprintTaskFilters } from '@/components/sprint/SprintTaskFilters'
import { TaskStatus } from '@/lib/types/story'

describe('SprintTaskFilters', () => {
  describe('AC2: Filtering by status with counts', () => {
    it('should render all status filter options', () => {
      const mockOnFilterChange = vi.fn()
      const mockOnGroupChange = vi.fn()

      render(
        <SprintTaskFilters
          selectedStatuses={[]}
          groupBy="story"
          onFilterChange={mockOnFilterChange}
          onGroupChange={mockOnGroupChange}
          taskCounts={{ available: 5, owned: 3, inprogress: 2, completed: 4 }}
        />
      )

      expect(screen.getByText(/available/i)).toBeInTheDocument()
      expect(screen.getByText(/owned/i)).toBeInTheDocument()
      expect(screen.getByText(/in progress/i)).toBeInTheDocument()
      expect(screen.getByText(/completed/i)).toBeInTheDocument()
    })

    it('should display task counts for each status', () => {
      const mockOnFilterChange = vi.fn()
      const mockOnGroupChange = vi.fn()

      render(
        <SprintTaskFilters
          selectedStatuses={[]}
          groupBy="story"
          onFilterChange={mockOnFilterChange}
          onGroupChange={mockOnGroupChange}
          taskCounts={{ available: 5, owned: 3, inprogress: 2, completed: 4 }}
        />
      )

      // Check that counts are displayed
      expect(screen.getByText('5')).toBeInTheDocument() // available
      expect(screen.getByText('3')).toBeInTheDocument() // owned
      expect(screen.getByText('2')).toBeInTheDocument() // inprogress
      expect(screen.getByText('4')).toBeInTheDocument() // completed
    })

      it('should call onFilterChange when a status is selected', () => {
        const mockOnFilterChange = vi.fn()
        const mockOnGroupChange = vi.fn()

        render(
          <SprintTaskFilters
            selectedStatuses={[]}
            groupBy="story"
            onFilterChange={mockOnFilterChange}
            onGroupChange={mockOnGroupChange}
            taskCounts={{ available: 5, owned: 3, inprogress: 2, completed: 4 }}
          />
        )

        const availableCheckbox = screen.getByRole('checkbox', { name: /available/i })
        fireEvent.click(availableCheckbox)

        expect(mockOnFilterChange).toHaveBeenCalledWith(['available'])
      })

      it('should call onFilterChange when a status is deselected', () => {
        const mockOnFilterChange = vi.fn()
        const mockOnGroupChange = vi.fn()

        render(
          <SprintTaskFilters
            selectedStatuses={['available']}
            groupBy="story"
            onFilterChange={mockOnFilterChange}
            onGroupChange={mockOnGroupChange}
            taskCounts={{ available: 5, owned: 3, inprogress: 2, completed: 4 }}
          />
        )

        const availableCheckbox = screen.getByRole('checkbox', { name: /available/i })
        fireEvent.click(availableCheckbox)

        expect(mockOnFilterChange).toHaveBeenCalledWith([])
      })

      it('should replace the previously selected status when a new one is chosen', () => {
        const mockOnFilterChange = vi.fn()
        const mockOnGroupChange = vi.fn()

        render(
          <SprintTaskFilters
            selectedStatuses={['available']}
            groupBy="story"
            onFilterChange={mockOnFilterChange}
            onGroupChange={mockOnGroupChange}
            taskCounts={{ available: 5, owned: 3, inprogress: 2, completed: 4 }}
          />
        )

        const ownedCheckbox = screen.getByRole('checkbox', { name: /owned/i })
        fireEvent.click(ownedCheckbox)

        expect(mockOnFilterChange).toHaveBeenCalledWith(['owned'])
      })

      it('should show correct checked state for selected statuses', () => {
        const mockOnFilterChange = vi.fn()
        const mockOnGroupChange = vi.fn()

        render(
          <SprintTaskFilters
            selectedStatuses={['available', 'inprogress']}
            groupBy="story"
            onFilterChange={mockOnFilterChange}
            onGroupChange={mockOnGroupChange}
            taskCounts={{ available: 5, owned: 3, inprogress: 2, completed: 4 }}
          />
        )

        expect(screen.getByRole('checkbox', { name: /available/i })).toBeChecked()
        expect(screen.getByRole('checkbox', { name: /owned/i })).not.toBeChecked()
        expect(screen.getByRole('checkbox', { name: /in progress/i })).not.toBeChecked()
        expect(screen.getByRole('checkbox', { name: /completed/i })).not.toBeChecked()
      })

      it('should normalize multiple incoming statuses to a single selection', async () => {
        const mockOnFilterChange = vi.fn()
        const mockOnGroupChange = vi.fn()

        render(
          <SprintTaskFilters
            selectedStatuses={['available', 'owned']}
            groupBy="story"
            onFilterChange={mockOnFilterChange}
            onGroupChange={mockOnGroupChange}
            taskCounts={{ available: 5, owned: 3, inprogress: 2, completed: 4 }}
          />
        )

        await waitFor(() => expect(mockOnFilterChange).toHaveBeenCalledWith(['available']))
      })
  })

  describe('AC2: Grouping controls', () => {
    it('should render grouping options', () => {
      const mockOnFilterChange = vi.fn()
      const mockOnGroupChange = vi.fn()

      render(
        <SprintTaskFilters
          selectedStatuses={[]}
          groupBy="story"
          onFilterChange={mockOnFilterChange}
          onGroupChange={mockOnGroupChange}
          taskCounts={{ available: 0, owned: 0, inprogress: 0, completed: 0 }}
        />
      )

      expect(screen.getByText(/group by story/i)).toBeInTheDocument()
      expect(screen.getByText(/group by status/i)).toBeInTheDocument()
    })

    it('should call onGroupChange when grouping is changed to status', () => {
      const mockOnFilterChange = vi.fn()
      const mockOnGroupChange = vi.fn()

      render(
        <SprintTaskFilters
          selectedStatuses={[]}
          groupBy="story"
          onFilterChange={mockOnFilterChange}
          onGroupChange={mockOnGroupChange}
          taskCounts={{ available: 0, owned: 0, inprogress: 0, completed: 0 }}
        />
      )

      const statusRadio = screen.getByRole('radio', { name: /group by status/i })
      fireEvent.click(statusRadio)

      expect(mockOnGroupChange).toHaveBeenCalledWith('status')
    })

    it('should call onGroupChange when grouping is changed to story', () => {
      const mockOnFilterChange = vi.fn()
      const mockOnGroupChange = vi.fn()

      render(
        <SprintTaskFilters
          selectedStatuses={[]}
          groupBy="status"
          onFilterChange={mockOnFilterChange}
          onGroupChange={mockOnGroupChange}
          taskCounts={{ available: 0, owned: 0, inprogress: 0, completed: 0 }}
        />
      )

      const storyRadio = screen.getByRole('radio', { name: /group by story/i })
      fireEvent.click(storyRadio)

      expect(mockOnGroupChange).toHaveBeenCalledWith('story')
    })

    it('should show correct selected state for groupBy', () => {
      const mockOnFilterChange = vi.fn()
      const mockOnGroupChange = vi.fn()

      render(
        <SprintTaskFilters
          selectedStatuses={[]}
          groupBy="status"
          onFilterChange={mockOnFilterChange}
          onGroupChange={mockOnGroupChange}
          taskCounts={{ available: 0, owned: 0, inprogress: 0, completed: 0 }}
        />
      )

      expect(screen.getByRole('radio', { name: /group by story/i })).not.toBeChecked()
      expect(screen.getByRole('radio', { name: /group by status/i })).toBeChecked()
    })
  })

  describe('AC2: Clear filters functionality', () => {
    it('should show clear filters button when filters are active', () => {
      const mockOnFilterChange = vi.fn()
      const mockOnGroupChange = vi.fn()

      render(
        <SprintTaskFilters
          selectedStatuses={['available']}
          groupBy="story"
          onFilterChange={mockOnFilterChange}
          onGroupChange={mockOnGroupChange}
          taskCounts={{ available: 5, owned: 3, inprogress: 2, completed: 4 }}
        />
      )

      expect(screen.getByText(/clear filters/i)).toBeInTheDocument()
    })

    it('should not show clear filters button when no filters are active', () => {
      const mockOnFilterChange = vi.fn()
      const mockOnGroupChange = vi.fn()

      render(
        <SprintTaskFilters
          selectedStatuses={[]}
          groupBy="story"
          onFilterChange={mockOnFilterChange}
          onGroupChange={mockOnGroupChange}
          taskCounts={{ available: 5, owned: 3, inprogress: 2, completed: 4 }}
        />
      )

      expect(screen.queryByText(/clear filters/i)).not.toBeInTheDocument()
    })

    it('should call onFilterChange with empty array when clear filters is clicked', () => {
      const mockOnFilterChange = vi.fn()
      const mockOnGroupChange = vi.fn()

      render(
        <SprintTaskFilters
          selectedStatuses={['available']}
          groupBy="story"
          onFilterChange={mockOnFilterChange}
          onGroupChange={mockOnGroupChange}
          taskCounts={{ available: 5, owned: 3, inprogress: 2, completed: 4 }}
        />
      )

      const clearButton = screen.getByText(/clear filters/i)
      fireEvent.click(clearButton)

      expect(mockOnFilterChange).toHaveBeenCalledWith([])
    })
  })

  describe('Edge cases', () => {
    it('should handle zero task counts', () => {
      const mockOnFilterChange = vi.fn()
      const mockOnGroupChange = vi.fn()

      render(
        <SprintTaskFilters
          selectedStatuses={[]}
          groupBy="story"
          onFilterChange={mockOnFilterChange}
          onGroupChange={mockOnGroupChange}
          taskCounts={{ available: 0, owned: 0, inprogress: 0, completed: 0 }}
        />
      )

      // Should still render counts as "0"
      const countElements = screen.getAllByText('0')
      expect(countElements.length).toBeGreaterThanOrEqual(4)
    })

    it('should handle large task counts', () => {
      const mockOnFilterChange = vi.fn()
      const mockOnGroupChange = vi.fn()

      render(
        <SprintTaskFilters
          selectedStatuses={[]}
          groupBy="story"
          onFilterChange={mockOnFilterChange}
          onGroupChange={mockOnGroupChange}
          taskCounts={{ available: 999, owned: 123, inprogress: 456, completed: 789 }}
        />
      )

      expect(screen.getByText('999')).toBeInTheDocument()
      expect(screen.getByText('123')).toBeInTheDocument()
      expect(screen.getByText('456')).toBeInTheDocument()
      expect(screen.getByText('789')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper test ids for filter controls', () => {
      const mockOnFilterChange = vi.fn()
      const mockOnGroupChange = vi.fn()

      render(
        <SprintTaskFilters
          selectedStatuses={[]}
          groupBy="story"
          onFilterChange={mockOnFilterChange}
          onGroupChange={mockOnGroupChange}
          taskCounts={{ available: 5, owned: 3, inprogress: 2, completed: 4 }}
        />
      )

      expect(screen.getByTestId('sprint-task-filters')).toBeInTheDocument()
      expect(screen.getByTestId('status-filters')).toBeInTheDocument()
      expect(screen.getByTestId('group-by-controls')).toBeInTheDocument()
    })

    it('should use proper ARIA labels for checkboxes', () => {
      const mockOnFilterChange = vi.fn()
      const mockOnGroupChange = vi.fn()

      render(
        <SprintTaskFilters
          selectedStatuses={[]}
          groupBy="story"
          onFilterChange={mockOnFilterChange}
          onGroupChange={mockOnGroupChange}
          taskCounts={{ available: 5, owned: 3, inprogress: 2, completed: 4 }}
        />
      )

      expect(screen.getByRole('checkbox', { name: /available/i })).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: /owned/i })).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: /in progress/i })).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: /completed/i })).toBeInTheDocument()
    })

    it('should use proper ARIA labels for radio buttons', () => {
      const mockOnFilterChange = vi.fn()
      const mockOnGroupChange = vi.fn()

      render(
        <SprintTaskFilters
          selectedStatuses={[]}
          groupBy="story"
          onFilterChange={mockOnFilterChange}
          onGroupChange={mockOnGroupChange}
          taskCounts={{ available: 5, owned: 3, inprogress: 2, completed: 4 }}
        />
      )

      expect(screen.getByRole('radio', { name: /group by story/i })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: /group by status/i })).toBeInTheDocument()
    })
  })
})
