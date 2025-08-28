'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Plus, Users, Clock, CheckCircle2, MoreVertical } from 'lucide-react'
import Link from 'next/link'
import { projectsApi } from '@/lib/api/projects'
import { backlogApi } from '@/lib/api/backlog'
import { useToast } from '@/hooks/use-toast'
import { Story, StoryStatus } from '@/lib/types/story'
import { AIAssistant } from '@/components/ai/ai-assistant'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const statusColumns = [
  { id: 'backlog', title: 'To Do', status: 'backlog' as StoryStatus },
  { id: 'in-progress', title: 'In Progress', status: 'in-progress' as StoryStatus },
  { id: 'in-review', title: 'In Review', status: 'in-review' as StoryStatus },
  { id: 'done', title: 'Done', status: 'done' as StoryStatus },
]

interface DraggableStoryCardProps {
  story: Story
}

function DraggableStoryCard({ story }: DraggableStoryCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: story.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const priorityColors = {
    low: 'bg-gray-100 text-gray-700',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700',
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-pointer transition-all hover:shadow-md ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      }`}
      data-testid="board-story-card"
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className={priorityColors[story.priority] || priorityColors.medium}>
                {story.priority}
              </Badge>
              {story.storyPoints && (
                <Badge variant="secondary">{story.storyPoints} pts</Badge>
              )}
            </div>
            <CardTitle className="text-sm line-clamp-2">{story.title}</CardTitle>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <MoreVertical className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
          {story.description || 'No description'}
        </p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>#{story.id.slice(-6)}</span>
          <span>0 tasks</span>
        </div>
      </CardContent>
    </Card>
  )
}

interface DroppableColumnProps {
  column: typeof statusColumns[0]
  stories: Story[]
}

function DroppableColumn({ column, stories }: DroppableColumnProps) {
  const columnStories = stories.filter(story => story.status === column.status)
  
  return (
    <Card className="h-fit" data-testid="board-column" data-column={column.id}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{column.title}</CardTitle>
          <Badge variant="secondary">{columnStories.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <SortableContext items={columnStories.map(s => s.id)} strategy={verticalListSortingStrategy}>
          {columnStories.length === 0 ? (
            <div className="min-h-[200px] flex items-center justify-center text-muted-foreground" data-testid="droppable-column">
              <div className="text-center">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No items</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3" data-testid="droppable-column">
              {columnStories.map((story) => (
                <DraggableStoryCard key={story.id} story={story} />
              ))}
            </div>
          )}
        </SortableContext>
      </CardContent>
    </Card>
  )
}

export default function ProjectBoardPage() {
  const params = useParams()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const projectId = params.id as string

  const [activeStory, setActiveStory] = useState<Story | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const { data: project, isLoading: projectLoading, error: projectError } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectsApi.getProject(projectId),
    enabled: !!projectId,
  })

  const { data: stories = [], isLoading: storiesLoading, error: storiesError } = useQuery({
    queryKey: ['stories', projectId],
    queryFn: () => backlogApi.getStories(projectId),
    enabled: !!projectId,
  })

  const updateStoryStatusMutation = useMutation({
    mutationFn: ({ storyId, status }: { storyId: string, status: StoryStatus }) =>
      backlogApi.updateStoryStatus(projectId, storyId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories', projectId] })
      toast({
        title: 'Story updated',
        description: 'Story status has been updated successfully.'
      })
    },
    onError: (error) => {
      toast({
        title: 'Failed to update story',
        description: 'Unable to update story status. Please try again.',
        variant: 'destructive'
      })
      console.error('Update story status error:', error)
    }
  })

  const isLoading = projectLoading || storiesLoading
  const error = projectError || storiesError

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const story = stories.find(s => s.id === active.id)
    setActiveStory(story || null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveStory(null)

    if (!over) return

    const activeStory = stories.find(s => s.id === active.id)
    if (!activeStory) return

    // Determine target status based on the drop area
    let targetStatus: StoryStatus | null = null
    
    // Check if dropped on a story in another column
    const targetStory = stories.find(s => s.id === over.id)
    if (targetStory && targetStory.status !== activeStory.status) {
      targetStatus = targetStory.status
    } else {
      // Check if dropped on a column container
      const targetColumn = statusColumns.find(col => col.id === over.id)
      if (targetColumn) {
        targetStatus = targetColumn.status
      }
    }

    if (targetStatus && targetStatus !== activeStory.status) {
      updateStoryStatusMutation.mutate({
        storyId: activeStory.id,
        status: targetStatus
      })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Sprint Board</h1>
            <p className="text-muted-foreground mt-2">Loading sprint board...</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {statusColumns.map((column) => (
              <Card key={column.id} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-32 bg-muted rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="mb-8">
            <Link href="/projects" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Link>
            <h1 className="text-3xl font-bold">Sprint Board</h1>
            <p className="text-muted-foreground mt-2">Project not found or failed to load</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-soft">
      <div className="container mx-auto py-8">
        <div className="mb-8 flex items-center justify-between animate-fade-in">
          <div>
            <Link href="/projects" className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors mb-4 group">
              <ArrowLeft className="h-4 w-4 mr-2 transition-transform group-hover:-translate-x-1" />
              Back to Projects
            </Link>
            <h1 className="text-4xl font-bold text-gradient-primary">
              {project.name} - Sprint Board
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Track progress with your agile sprint board
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={`/projects/${projectId}/backlog`}>
              <Button variant="outline">
                View Backlog
              </Button>
            </Link>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Start Sprint
            </Button>
          </div>
        </div>

        {/* Sprint Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl">{stories.length}</CardTitle>
              <CardDescription>Total Stories</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl">
                {stories.filter(s => s.status === 'in-progress').length}
              </CardTitle>
              <CardDescription>In Progress</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl">
                {stories.filter(s => s.status === 'in-review').length}
              </CardTitle>
              <CardDescription>In Review</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl">
                {stories.filter(s => s.status === 'done').length}
              </CardTitle>
              <CardDescription>Completed</CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* AI Assistant */}
        <div className="mb-8">
          <AIAssistant projectId={projectId} context="general" />
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {statusColumns.map((column) => (
              <DroppableColumn
                key={column.id}
                column={column}
                stories={stories}
              />
            ))}
          </div>

          <DragOverlay>
            {activeStory ? (
              <div className="transform rotate-2 opacity-90">
                <DraggableStoryCard story={activeStory} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}