import { getProjects, getStories } from './api'
import ClientPage from './client-page'

export default async function DashboardPage() {
  const projects = await getProjects()

  const projectsWithStories = await Promise.all(
    projects.map(async (project) => {
      const stories = await getStories(project.id)
      return { ...project, stories }
    })
  )

  // The original page also fetched recent activity and user performance,
  // but the API calls for those don't exist yet. I'll pass empty arrays
  // for now.
  const recentActivity: any[] = []
  const userPerformance: any[] = []

  return (
    <ClientPage
      projects={projectsWithStories}
      recentActivity={recentActivity}
      userPerformance={userPerformance}
    />
  )
}
