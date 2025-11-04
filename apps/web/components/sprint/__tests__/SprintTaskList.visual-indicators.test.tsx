/**
 * Unit Tests for SprintTaskList Visual Indicators
 *
 * These tests verify the visual indicator logic for task availability
 * without requiring a full E2E setup.
 *
 * Acceptance Criteria 3 (AC3):
 * - Available tasks should be clearly visually distinguished
 * - My own tasks should be highlighted or marked
 * - Tasks owned by others should show the owner name
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SprintTaskList } from '../SprintTaskList'
import { Story, Task, TaskStatus } from '@/lib/types/story'

// Mock data factory
const createTask = (overrides?: Partial<Task>): Task => ({
  id: '12345678-1234-1234-1234-123456789012',
  storyId: '87654321-4321-4321-4321-210987654321',
  title: 'Test Task',
  description: 'Test Description',
  status: 'available' as TaskStatus,
  acceptanceCriteriaRefs: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

const createStory = (tasks: Task[]): Story => ({
  id: '87654321-4321-4321-4321-210987654321',
  projectId: 'project-123',
  title: 'Test Story',
  description: 'Test Story Description',
  status: 'ready',
  labels: [],
  acceptanceCriteria: [],
  tasks,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

describe('SprintTaskList - Visual Indicators (AC3)', () => {
  describe('Available Tasks - Visual Distinction', () => {
    it('should render available task with dashed border class', () => {
      const availableTask = createTask({
        status: 'available',
        ownerUserId: undefined,
      })
      const story = createStory([availableTask])

      render(
        <SprintTaskList
          stories={[story]}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="current-user-123"
        />
      )

      const taskCard = screen.getByTestId(`task-card-${availableTask.id}`)
      expect(taskCard).toBeTruthy()
      expect(taskCard.className).toContain('border-dashed')
    })

    it('should render "Available to claim" text for available tasks', () => {
      const availableTask = createTask({
        status: 'available',
        ownerUserId: undefined,
      })
      const story = createStory([availableTask])

      render(
        <SprintTaskList
          stories={[story]}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="current-user-123"
        />
      )

      expect(screen.getByText('Available to claim')).toBeTruthy()
    })

    it('should have gray border for available tasks', () => {
      const availableTask = createTask({
        status: 'available',
        ownerUserId: undefined,
      })
      const story = createStory([availableTask])

      render(
        <SprintTaskList
          stories={[story]}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="current-user-123"
        />
      )

      const taskCard = screen.getByTestId(`task-card-${availableTask.id}`)
      expect(taskCard.className).toContain('border-gray-200')
    })

    it('should NOT have ring highlight for available tasks', () => {
      const availableTask = createTask({
        status: 'available',
        ownerUserId: undefined,
      })
      const story = createStory([availableTask])

      render(
        <SprintTaskList
          stories={[story]}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="current-user-123"
        />
      )

      const taskCard = screen.getByTestId(`task-card-${availableTask.id}`)
      expect(taskCard.className).not.toContain('ring-2')
      expect(taskCard.className).not.toContain('ring-blue-500')
    })

    it('should set data-my-task to false for available tasks', () => {
      const availableTask = createTask({
        status: 'available',
        ownerUserId: undefined,
      })
      const story = createStory([availableTask])

      render(
        <SprintTaskList
          stories={[story]}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="current-user-123"
        />
      )

      const taskCard = screen.getByTestId(`task-card-${availableTask.id}`)
      expect(taskCard.getAttribute('data-my-task')).toBe('false')
    })
  })

  describe('My Tasks - Highlighted and Marked', () => {
    it('should render my task with blue ring highlight', () => {
      const myTask = createTask({
        status: 'owned',
        ownerUserId: 'current-user-123',
      })
      const story = createStory([myTask])

      render(
        <SprintTaskList
          stories={[story]}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="current-user-123"
        />
      )

      const taskCard = screen.getByTestId(`task-card-${myTask.id}`)
      expect(taskCard.className).toContain('ring-2')
      expect(taskCard.className).toContain('ring-blue-500')
      expect(taskCard.className).toContain('ring-offset-2')
    })

    it('should render "My Task" badge for my tasks', () => {
      const myTask = createTask({
        status: 'owned',
        ownerUserId: 'current-user-123',
      })
      const story = createStory([myTask])

      render(
        <SprintTaskList
          stories={[story]}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="current-user-123"
        />
      )

      expect(screen.getByText('My Task')).toBeTruthy()
    })

    it('should render "You" as owner for my tasks', () => {
      const myTask = createTask({
        status: 'owned',
        ownerUserId: 'current-user-123',
      })
      const story = createStory([myTask])

      render(
        <SprintTaskList
          stories={[story]}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="current-user-123"
        />
      )

      expect(screen.getByText('You')).toBeTruthy()
      expect(screen.queryByText(/Owned by/)).toBeFalsy()
    })

    it('should set data-my-task to true for my tasks', () => {
      const myTask = createTask({
        status: 'owned',
        ownerUserId: 'current-user-123',
      })
      const story = createStory([myTask])

      render(
        <SprintTaskList
          stories={[story]}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="current-user-123"
        />
      )

      const taskCard = screen.getByTestId(`task-card-${myTask.id}`)
      expect(taskCard.getAttribute('data-my-task')).toBe('true')
    })

    it('should NOT render "Available to claim" for my tasks', () => {
      const myTask = createTask({
        status: 'owned',
        ownerUserId: 'current-user-123',
      })
      const story = createStory([myTask])

      render(
        <SprintTaskList
          stories={[story]}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="current-user-123"
        />
      )

      expect(screen.queryByText('Available to claim')).toBeFalsy()
    })

    it('should maintain blue ring for my in-progress tasks', () => {
      const myInProgressTask = createTask({
        status: 'inprogress',
        ownerUserId: 'current-user-123',
      })
      const story = createStory([myInProgressTask])

      render(
        <SprintTaskList
          stories={[story]}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="current-user-123"
        />
      )

      const taskCard = screen.getByTestId(`task-card-${myInProgressTask.id}`)
      expect(taskCard.className).toContain('ring-2')
      expect(taskCard.className).toContain('ring-blue-500')
      expect(screen.getByText('My Task')).toBeTruthy()
    })
  })

  describe('Tasks Owned by Others - Show Owner Name', () => {
    it('should render owner ID for tasks owned by others', () => {
      const othersTask = createTask({
        status: 'owned',
        ownerUserId: 'other-user-456',
      })
      const story = createStory([othersTask])

      render(
        <SprintTaskList
          stories={[story]}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="current-user-123"
        />
      )

      expect(screen.getByText(/Owned by other-user-456/)).toBeTruthy()
    })

    it('should NOT render "My Task" badge for tasks owned by others', () => {
      const othersTask = createTask({
        status: 'owned',
        ownerUserId: 'other-user-456',
      })
      const story = createStory([othersTask])

      render(
        <SprintTaskList
          stories={[story]}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="current-user-123"
        />
      )

      expect(screen.queryByText('My Task')).toBeFalsy()
    })

    it('should NOT have ring highlight for tasks owned by others', () => {
      const othersTask = createTask({
        status: 'owned',
        ownerUserId: 'other-user-456',
      })
      const story = createStory([othersTask])

      render(
        <SprintTaskList
          stories={[story]}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="current-user-123"
        />
      )

      const taskCard = screen.getByTestId(`task-card-${othersTask.id}`)
      expect(taskCard.className).not.toContain('ring-2')
      expect(taskCard.className).not.toContain('ring-blue-500')
    })

    it('should set data-my-task to false for tasks owned by others', () => {
      const othersTask = createTask({
        status: 'owned',
        ownerUserId: 'other-user-456',
      })
      const story = createStory([othersTask])

      render(
        <SprintTaskList
          stories={[story]}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="current-user-123"
        />
      )

      const taskCard = screen.getByTestId(`task-card-${othersTask.id}`)
      expect(taskCard.getAttribute('data-my-task')).toBe('false')
    })

    it('should NOT render "Available to claim" for tasks owned by others', () => {
      const othersTask = createTask({
        status: 'owned',
        ownerUserId: 'other-user-456',
      })
      const story = createStory([othersTask])

      render(
        <SprintTaskList
          stories={[story]}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="current-user-123"
        />
      )

      expect(screen.queryByText('Available to claim')).toBeFalsy()
    })
  })

  describe('Comprehensive Visual Distinction', () => {
    it('should clearly distinguish all three task types on the same board', () => {
      const availableTask = createTask({
        id: 'available-task-id',
        title: 'Available Task',
        status: 'available',
        ownerUserId: undefined,
      })

      const myTask = createTask({
        id: 'my-task-id',
        title: 'Task Owned By Me',
        status: 'owned',
        ownerUserId: 'current-user-123',
      })

      const othersTask = createTask({
        id: 'others-task-id',
        title: 'Others Task',
        status: 'owned',
        ownerUserId: 'other-user-456',
      })

      const story = createStory([availableTask, myTask, othersTask])

      render(
        <SprintTaskList
          stories={[story]}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="current-user-123"
        />
      )

      // Available task checks
      const availableCard = screen.getByTestId('task-card-available-task-id')
      expect(availableCard.className).toContain('border-dashed')
      expect(availableCard.className).not.toContain('ring-2')
      expect(screen.getByText('Available to claim')).toBeTruthy()

      // My task checks
      const myCard = screen.getByTestId('task-card-my-task-id')
      expect(myCard.className).toContain('ring-2')
      expect(myCard.className).toContain('ring-blue-500')
      expect(screen.getByText('My Task')).toBeTruthy()
      expect(screen.getByText('You')).toBeTruthy()

      // Others task checks
      const othersCard = screen.getByTestId('task-card-others-task-id')
      expect(othersCard.className).not.toContain('ring-2')
      expect(othersCard.className).not.toContain('border-dashed')
      expect(screen.getByText(/Owned by other-user-456/)).toBeTruthy()
    })
  })

  describe('Status-Specific Border Colors', () => {
    it('should render completed tasks with green border', () => {
      const completedTask = createTask({
        status: 'completed',
        ownerUserId: 'current-user-123',
      })
      const story = createStory([completedTask])

      render(
        <SprintTaskList
          stories={[story]}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="current-user-123"
        />
      )

      const taskCard = screen.getByTestId(`task-card-${completedTask.id}`)
      expect(taskCard.className).toContain('border-green-200')
    })

    it('should render in-progress tasks with yellow border', () => {
      const inProgressTask = createTask({
        status: 'inprogress',
        ownerUserId: 'current-user-123',
      })
      const story = createStory([inProgressTask])

      render(
        <SprintTaskList
          stories={[story]}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="current-user-123"
        />
      )

      const taskCard = screen.getByTestId(`task-card-${inProgressTask.id}`)
      expect(taskCard.className).toContain('border-yellow-200')
    })

    it('should render owned tasks with blue border', () => {
      const ownedTask = createTask({
        status: 'owned',
        ownerUserId: 'current-user-123',
      })
      const story = createStory([ownedTask])

      render(
        <SprintTaskList
          stories={[story]}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="current-user-123"
        />
      )

      const taskCard = screen.getByTestId(`task-card-${ownedTask.id}`)
      expect(taskCard.className).toContain('border-blue-200')
    })
  })

  describe('Edge Cases', () => {
    it('should handle task with no current user (guest view)', () => {
      const task = createTask({
        status: 'owned',
        ownerUserId: 'some-user-123',
      })
      const story = createStory([task])

      render(
        <SprintTaskList
          stories={[story]}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId={undefined}
        />
      )

      const taskCard = screen.getByTestId(`task-card-${task.id}`)
      expect(taskCard.getAttribute('data-my-task')).toBe('false')
      expect(screen.queryByText('My Task')).toBeFalsy()
    })

    it('should handle completed task owned by current user', () => {
      const completedTask = createTask({
        status: 'completed',
        ownerUserId: 'current-user-123',
      })
      const story = createStory([completedTask])

      render(
        <SprintTaskList
          stories={[story]}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="current-user-123"
        />
      )

      const taskCard = screen.getByTestId(`task-card-${completedTask.id}`)
      // Completed tasks should still show "My Task" badge
      expect(screen.getByText('My Task')).toBeTruthy()
      // But should have green border (status takes precedence)
      expect(taskCard.className).toContain('border-green-200')
      // Should still have ring highlight
      expect(taskCard.className).toContain('ring-2')
      expect(taskCard.className).toContain('ring-blue-500')
    })
  })
})
