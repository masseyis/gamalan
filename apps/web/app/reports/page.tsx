'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Target, 
  Users, 
  Calendar,
  Download,
  Filter,
  RefreshCw
} from 'lucide-react'

const mockMetrics = {
  totalProjects: 3,
  completedStories: 24,
  inProgressStories: 8,
  totalStoryPoints: 156,
  averageVelocity: 42,
  teamUtilization: 85
}

const mockReports = [
  {
    id: '1',
    title: 'Sprint Velocity Report',
    description: 'Track team velocity over time',
    lastGenerated: '2025-09-01',
    type: 'velocity'
  },
  {
    id: '2',
    title: 'Burndown Chart',
    description: 'Sprint progress tracking',
    lastGenerated: '2025-09-01',
    type: 'burndown'
  },
  {
    id: '3',
    title: 'Story Completion Report',
    description: 'Story delivery metrics',
    lastGenerated: '2025-08-31',
    type: 'completion'
  }
]

export default function ReportsPage() {
  return (
    <div className="bg-gradient-soft">
      <div className="container mx-auto py-8">
        <div className="mb-8 flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-4xl font-bold text-gradient-primary">Reports</h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Track performance and analyze team metrics
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filter
            </Button>
            <Button className="shadow-soft hover:shadow-elevated transition-all duration-200 gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Metrics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockMetrics.totalProjects}</div>
              <p className="text-xs text-muted-foreground">
                +2 from last month
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Stories</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockMetrics.completedStories}</div>
              <p className="text-xs text-muted-foreground">
                +12% from last sprint
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Team Velocity</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockMetrics.averageVelocity}</div>
              <p className="text-xs text-muted-foreground">
                Story points per sprint
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockMetrics.inProgressStories}</div>
              <p className="text-xs text-muted-foreground">
                Stories currently active
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Story Points</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockMetrics.totalStoryPoints}</div>
              <p className="text-xs text-muted-foreground">
                Total delivered this quarter
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Team Utilization</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockMetrics.teamUtilization}%</div>
              <p className="text-xs text-muted-foreground">
                Capacity utilization
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Available Reports */}
        <Card className="card-elevated">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Available Reports</CardTitle>
                <CardDescription>
                  Generate and download detailed analytics reports
                </CardDescription>
              </div>
              <Button variant="outline" size="icon">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockReports.map((report) => (
                <div 
                  key={report.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <BarChart3 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">{report.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {report.description}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Calendar className="h-3 w-3" />
                        Last generated: {new Date(report.lastGenerated).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="capitalize">
                      {report.type}
                    </Badge>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Generate
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            
            {mockReports.length === 0 && (
              <div className="text-center py-8">
                <div className="p-4 bg-primary/10 rounded-full w-fit mx-auto mb-4">
                  <BarChart3 className="h-12 w-12 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No reports available</h3>
                <p className="text-muted-foreground mb-6">
                  Reports will be available once you have project data
                </p>
                <Button>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Check for Data
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}