import { SalungaBadge } from "./badge-variants"
import { SalungaCard, SalungaCardBody } from "./card-layout"

interface KanbanTask {
  id: string
  title: string
  description: string
  assignee: string
  priority: "low" | "medium" | "high"
  tags: string[]
}

interface KanbanColumnProps {
  title: string
  tasks: KanbanTask[]
  color: "primary" | "warning" | "success" | "accent"
}

export function SalungaKanbanColumn({ title, tasks, color }: KanbanColumnProps) {
  const colorStyles = {
    primary: "border-salunga-primary bg-salunga-primary-light",
    warning: "border-salunga-warning bg-salunga-warning-light",
    success: "border-salunga-success bg-salunga-success-light",
    accent: "border-salunga-accent bg-salunga-accent-light",
  }

  const priorityColors = {
    low: "success",
    medium: "warning",
    high: "error",
  } as const

  return (
    <div className="w-80 flex-shrink-0">
      {/* Column Header */}
      <div className={`p-4 rounded-t-salunga-lg border-t-4 ${colorStyles[color]}`}>
        <div className="flex items-center justify-between">
          <h3 className="font-salunga-heading font-semibold text-salunga-fg">{title}</h3>
          <SalungaBadge variant="secondary" size="sm">
            {tasks.length}
          </SalungaBadge>
        </div>
      </div>

      {/* Column Body */}
      <div className="bg-salunga-bg-secondary border-l border-r border-salunga-border min-h-96 p-4 space-y-3">
        {tasks.map((task) => (
          <SalungaCard key={task.id} className="cursor-pointer hover:shadow-salunga-md transition-shadow">
            <SalungaCardBody className="p-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-medium text-salunga-fg text-sm leading-tight">{task.title}</h4>
                  <SalungaBadge variant={priorityColors[task.priority]} size="sm">
                    {task.priority}
                  </SalungaBadge>
                </div>

                <p className="text-xs text-salunga-fg-muted line-clamp-2">{task.description}</p>

                <div className="flex flex-wrap gap-1">
                  {task.tags.map((tag) => (
                    <SalungaBadge key={tag} variant="secondary" size="sm">
                      {tag}
                    </SalungaBadge>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-salunga-accent rounded-full flex items-center justify-center text-white text-xs font-medium">
                      {task.assignee
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <span className="text-xs text-salunga-fg-muted">{task.assignee}</span>
                  </div>
                  <button className="text-salunga-fg-muted hover:text-salunga-primary text-xs">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </SalungaCardBody>
          </SalungaCard>
        ))}

        {/* Add Task Button */}
        <button className="w-full p-3 border-2 border-dashed border-salunga-border hover:border-salunga-primary hover:bg-salunga-primary-light rounded-salunga-md transition-colors text-salunga-fg-muted hover:text-salunga-primary text-sm">
          + Add Task
        </button>
      </div>

      {/* Column Footer */}
      <div className="bg-salunga-bg-secondary border border-t-0 border-salunga-border rounded-b-salunga-lg p-2">
        <div className="text-xs text-salunga-fg-muted text-center">
          {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
        </div>
      </div>
    </div>
  )
}

// Example usage component
export function KanbanShowcase() {
  const sampleTasks: KanbanTask[] = [
    {
      id: "1",
      title: "Design user authentication flow",
      description: "Create wireframes and mockups for the login and registration process",
      assignee: "Sarah Miller",
      priority: "high",
      tags: ["UI/UX", "Auth"],
    },
    {
      id: "2",
      title: "Implement API endpoints",
      description: "Build REST API for user management and project operations",
      assignee: "John Doe",
      priority: "medium",
      tags: ["Backend", "API"],
    },
  ]

  const inProgressTasks: KanbanTask[] = [
    {
      id: "3",
      title: "Setup database schema",
      description: "Design and implement the database structure for the application",
      assignee: "Mike Johnson",
      priority: "high",
      tags: ["Database", "Backend"],
    },
  ]

  const completedTasks: KanbanTask[] = [
    {
      id: "4",
      title: "Project planning session",
      description: "Define project scope, timeline, and resource allocation",
      assignee: "Lisa Chen",
      priority: "low",
      tags: ["Planning", "Management"],
    },
  ]

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-salunga-heading font-semibold text-salunga-fg">Kanban Board</h3>
      <div className="flex gap-4 overflow-x-auto pb-4">
        <SalungaKanbanColumn title="To Do" tasks={sampleTasks} color="primary" />
        <SalungaKanbanColumn title="In Progress" tasks={inProgressTasks} color="warning" />
        <SalungaKanbanColumn title="Completed" tasks={completedTasks} color="success" />
      </div>
    </div>
  )
}
