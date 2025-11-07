'use client'

import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Calendar, Target, TrendingUp } from 'lucide-react'
import { Sprint } from '@/lib/types/team'
import { Story } from '@/lib/types/story'

export interface SprintHeaderProps {
  sprint: Sprint
  stories: Story[]
}

/**
 * SprintHeader component displays sprint context information including:
 * - Sprint name, start/end dates, and days remaining
 * - Progress indicator showing percentage of tasks completed
 * - Total number of stories in the sprint
 *
 * This component satisfies AC5 of the Sprint Tasks View story.
 */
export function SprintHeader({ sprint, stories }: SprintHeaderProps) {
  // Calculate days remaining
  const daysRemaining = useMemo(() => {
    const endDate = new Date(sprint.endDate)
    const now = new Date()
    const diffTime = endDate.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(0, diffDays)
  }, [sprint.endDate])

  // Calculate task completion progress
  const taskProgress = useMemo(() => {
    const allTasks = stories.flatMap((story) => story.tasks || [])
    const totalTasks = allTasks.length
    const completedTasks = allTasks.filter((task) => task.status === 'completed').length
    const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    return {
      totalTasks,
      completedTasks,
      percentage,
    }
  }, [stories])

  // Deduplicate stories to avoid counting duplicates that may appear in data responses
  const uniqueStoryCount = useMemo(() => {
    const uniqueStoryIds = new Set(stories.map((story) => story.id))
    return uniqueStoryIds.size
  }, [stories])

  // Format dates for display - use specific format to match test expectations
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Format date range display
  const dateRangeDisplay = `${formatDate(sprint.startDate)} - ${formatDate(sprint.endDate)}`

  return (
    <Card className="mb-6" data-testid="sprint-header">
      <CardContent className="pt-6">
        <div className="space-y-6">
          {/* Sprint Name */}
          <div>
            <p className="text-sm text-muted-foreground uppercase tracking-wide mb-2">
              Sprint Task Board
            </p>
            <h1 className="text-4xl font-bold text-foreground" data-testid="sprint-name">
              {sprint.name}
            </h1>
            {sprint.goal && (
              <p className="text-sm text-muted-foreground mt-2" data-testid="sprint-goal">
                {sprint.goal}
              </p>
            )}
          </div>

          {/* Sprint Dates and Days Remaining */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground" data-testid="sprint-dates">
                {dateRangeDisplay}
              </p>
              <p className="text-sm text-muted-foreground mt-1" data-testid="days-remaining">
                {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
              </p>
            </div>
          </div>

          {/* Sprint Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Stories in Sprint */}
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <Target className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-1">Stories in sprint</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="story-count">
                    {uniqueStoryCount} {uniqueStoryCount === 1 ? 'story' : 'stories'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Total Tasks */}
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Total tasks</p>
                  <p className="text-2xl font-bold text-foreground">
                    {taskProgress.totalTasks}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Task Progress */}
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <TrendingUp className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-1">Task progress</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="task-progress">
                    {taskProgress.completedTasks} of {taskProgress.totalTasks} tasks
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Tasks Progress */}
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Tasks progress</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="progress-percentage">
                    {taskProgress.percentage}%
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress
              value={taskProgress.percentage}
              className="h-3"
              data-testid="progress-bar"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
