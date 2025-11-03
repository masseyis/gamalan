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

  // Format dates for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <Card className="mb-6" data-testid="sprint-header">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Sprint Name */}
          <div>
            <h2 className="text-2xl font-bold text-foreground" data-testid="sprint-name">
              {sprint.name}
            </h2>
            {sprint.goal && (
              <p className="text-sm text-muted-foreground mt-1" data-testid="sprint-goal">
                {sprint.goal}
              </p>
            )}
          </div>

          {/* Sprint Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Sprint Dates */}
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Sprint Dates
                </p>
                <p className="text-sm font-medium text-foreground mt-1" data-testid="sprint-dates">
                  {formatDate(sprint.startDate)} - {formatDate(sprint.endDate)}
                </p>
                <p
                  className="text-xs text-muted-foreground mt-0.5"
                  data-testid="days-remaining"
                >
                  {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
                </p>
              </div>
            </div>

            {/* Story Count */}
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <Target className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Stories
                </p>
                <p className="text-sm font-medium text-foreground mt-1" data-testid="story-count">
                  {stories.length} {stories.length === 1 ? 'story' : 'stories'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  in this sprint
                </p>
              </div>
            </div>

            {/* Task Progress */}
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Task Progress
                </p>
                <p
                  className="text-sm font-medium text-foreground mt-1"
                  data-testid="task-progress"
                >
                  {taskProgress.completedTasks} of {taskProgress.totalTasks} tasks
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {taskProgress.percentage}% complete
                </p>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Overall Progress</span>
              <span
                className="font-medium text-foreground"
                data-testid="progress-percentage"
              >
                {taskProgress.percentage}%
              </span>
            </div>
            <Progress
              value={taskProgress.percentage}
              className="h-2"
              data-testid="progress-bar"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
