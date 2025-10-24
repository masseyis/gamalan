import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  Target,
  Calendar,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  Lightbulb,
  AlertCircle,
} from 'lucide-react'
import Link from 'next/link'
import { UserRole } from '@/lib/types/user'

interface UserGuideProps {
  userRole?: UserRole
  context?: 'dashboard' | 'projects' | 'teams' | 'sprints' | 'stories' | 'tasks'
  showHelp?: boolean
}

export function UserGuide({ userRole, context, showHelp = true }: UserGuideProps) {
  if (!showHelp || !userRole) return null

  const getContextualGuidance = () => {
    switch (context) {
      case 'dashboard':
        return {
          title: 'Getting Started Guide',
          description: 'Learn how to use the platform effectively in your role',
          items: getRoleSpecificGuidance(userRole),
        }
      case 'projects':
        return {
          title: 'Project Management',
          description: 'Understand project workflows and your responsibilities',
          items: getProjectGuidance(userRole),
        }
      case 'teams':
        return {
          title: 'Team Collaboration',
          description: 'Work effectively with your development team',
          items: getTeamGuidance(userRole),
        }
      case 'sprints':
        return {
          title: 'Sprint Planning',
          description: 'Manage sprint cycles and track progress',
          items: getSprintGuidance(userRole),
        }
      case 'stories':
        return {
          title: 'Story Management',
          description: 'Create and manage user stories effectively',
          items: getStoryGuidance(userRole),
        }
      case 'tasks':
        return {
          title: 'Task Ownership',
          description: 'Take ownership and track task progress',
          items: getTaskGuidance(userRole),
        }
      default:
        return null
    }
  }

  const guidance = getContextualGuidance()
  if (!guidance) return null

  return (
    <Card className="bg-blue-50 border-blue-200">
      <CardHeader>
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-blue-600" />
          <CardTitle className="text-blue-900">{guidance.title}</CardTitle>
        </div>
        <CardDescription className="text-blue-700">{guidance.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {guidance.items.map((item, index) => (
            <div key={index} className="flex items-start gap-3">
              <item.icon className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-medium text-blue-900">{item.title}</div>
                <div className="text-sm text-blue-800">{item.description}</div>
                {'action' in item && item.action && (
                  <Link href={item.action.href} className="inline-block mt-1">
                    <Button size="sm" variant="outline" className="text-xs">
                      {item.action.label}
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function getRoleSpecificGuidance(role: UserRole) {
  const baseGuidance = [
    {
      icon: Users,
      title: 'Join Your Team',
      description: 'Connect with your development team to start collaborating on projects.',
      action: { href: '/teams', label: 'View Teams' },
    },
  ]

  switch (role) {
    case 'sponsor':
      return [
        {
          icon: Target,
          title: 'Monitor Project Progress',
          description: 'Track high-level project status and team velocity metrics.',
          action: { href: '/projects', label: 'View Projects' },
        },
        {
          icon: Users,
          title: 'Review Team Performance',
          description: 'Monitor team productivity and identify improvement opportunities.',
          action: { href: '/teams', label: 'View Teams' },
        },
      ]

    case 'product_owner':
      return [
        {
          icon: Target,
          title: 'Create User Stories',
          description: 'Define features and requirements through well-structured user stories.',
          action: { href: '/projects', label: 'Manage Backlog' },
        },
        {
          icon: Calendar,
          title: 'Plan Sprints',
          description: 'Organize stories into sprints and set team capacity.',
          action: { href: '/teams', label: 'Manage Sprints' },
        },
        {
          icon: CheckCircle2,
          title: 'Accept Delivered Work',
          description: 'Review completed stories and provide feedback to the team.',
        },
        ...baseGuidance,
      ]

    case 'managing_contributor':
      return [
        {
          icon: Users,
          title: 'Manage Team Settings',
          description: 'Configure team capacity, invite members, and manage sprint planning.',
          action: { href: '/teams', label: 'Team Management' },
        },
        {
          icon: Target,
          title: 'Take Task Ownership',
          description: 'Claim tasks from stories and track your development progress.',
        },
        {
          icon: Calendar,
          title: 'Support Sprint Planning',
          description: 'Help estimate stories and plan sprint capacity with the Product Owner.',
        },
        ...baseGuidance,
      ]

    case 'contributor':
      return [
        {
          icon: Target,
          title: 'Take Task Ownership',
          description: 'Claim tasks that match your specialty and track your progress.',
        },
        {
          icon: CheckCircle2,
          title: 'Update Task Status',
          description: 'Keep your tasks current to help the team track sprint progress.',
        },
        ...baseGuidance,
      ]

    default:
      return baseGuidance
  }
}

function getProjectGuidance(role: UserRole) {
  const common = [
    {
      icon: Target,
      title: 'Understanding Projects',
      description: 'Projects organize related user stories and track overall progress.',
    },
  ]

  if (role === 'product_owner') {
    return [
      ...common,
      {
        icon: BookOpen,
        title: 'Create Projects',
        description: 'Set up new projects with clear objectives and team assignments.',
        action: { href: '/projects/new', label: 'New Project' },
      },
      {
        icon: Target,
        title: 'Manage Backlog',
        description: 'Prioritize user stories and ensure they have clear acceptance criteria.',
      },
    ]
  }

  return common
}

function getTeamGuidance(role: UserRole) {
  const common = [
    {
      icon: Users,
      title: 'Team Collaboration',
      description: 'Teams are organized by specialty and work together on sprints.',
    },
  ]

  if (['product_owner', 'managing_contributor'].includes(role)) {
    return [
      ...common,
      {
        icon: Calendar,
        title: 'Sprint Planning',
        description: 'Plan sprint capacity based on team velocity and availability.',
      },
      {
        icon: Target,
        title: 'Velocity Tracking',
        description: 'Monitor team performance and adjust capacity planning accordingly.',
      },
    ]
  }

  return [
    ...common,
    {
      icon: CheckCircle2,
      title: 'Contributing to Sprints',
      description: 'Take ownership of tasks that match your skills and specialty.',
    },
  ]
}

function getSprintGuidance(role: UserRole) {
  const common = [
    {
      icon: Calendar,
      title: 'Sprint Workflow',
      description: 'Sprints follow a Planning → Active → Review → Completed cycle.',
    },
  ]

  if (['product_owner', 'managing_contributor'].includes(role)) {
    return [
      ...common,
      {
        icon: Target,
        title: 'Setting Sprint Goals',
        description: 'Define clear, achievable objectives for each sprint iteration.',
      },
      {
        icon: Users,
        title: 'Capacity Planning',
        description: 'Consider team availability and historical velocity when planning.',
      },
    ]
  }

  return [
    ...common,
    {
      icon: CheckCircle2,
      title: 'Sprint Participation',
      description: 'Claim tasks early in the sprint and update progress regularly.',
    },
  ]
}

function getStoryGuidance(role: UserRole) {
  if (role === 'product_owner') {
    return [
      {
        icon: BookOpen,
        title: 'Writing Good Stories',
        description: 'Follow the "As a... I want... So that..." format for clarity.',
      },
      {
        icon: CheckCircle2,
        title: 'Acceptance Criteria',
        description: 'Define clear Given/When/Then criteria for each story.',
      },
      {
        icon: Target,
        title: 'Story Estimation',
        description: 'Work with the team to estimate story complexity in points.',
      },
    ]
  }

  return [
    {
      icon: Target,
      title: 'Understanding Stories',
      description:
        'Stories define features from a user perspective with clear acceptance criteria.',
    },
    {
      icon: CheckCircle2,
      title: 'Story Progression',
      description: 'Stories move through analysis, development, testing, and acceptance phases.',
    },
  ]
}

function getTaskGuidance(role: UserRole) {
  if (['contributor', 'managing_contributor'].includes(role)) {
    return [
      {
        icon: Target,
        title: 'Task Ownership',
        description: 'Claim tasks that match your specialty and skill level.',
      },
      {
        icon: CheckCircle2,
        title: 'Progress Updates',
        description: 'Update task status regularly to keep the team informed.',
      },
      {
        icon: Lightbulb,
        title: 'Best Practices',
        description: 'Complete tasks in order and communicate blockers early.',
      },
    ]
  }

  return [
    {
      icon: Target,
      title: 'Task Breakdown',
      description: 'Stories are broken into smaller, manageable development tasks.',
    },
  ]
}

export function RoleExplanation({ role }: { role: UserRole }) {
  const roleInfo = {
    sponsor: {
      title: 'Sponsor',
      description: 'Strategic oversight and project funding decisions',
      responsibilities: [
        'Monitor high-level project progress and ROI',
        'Make strategic decisions about project direction',
        'Approve major resource allocations',
        'Review team performance metrics',
      ],
    },
    product_owner: {
      title: 'Product Owner',
      description: 'Product vision and backlog management',
      responsibilities: [
        'Define and prioritize user stories',
        'Set acceptance criteria for features',
        'Make product decisions and trade-offs',
        'Accept completed work from the team',
      ],
    },
    managing_contributor: {
      title: 'Managing Contributor',
      description: 'Technical leadership and team coordination',
      responsibilities: [
        'Manage team settings and sprint planning',
        'Coordinate development activities',
        'Take ownership of complex technical tasks',
        'Support other contributors with guidance',
      ],
    },
    contributor: {
      title: 'Contributor',
      description: 'Individual contributor focused on development',
      responsibilities: [
        'Take ownership of development tasks',
        'Update task progress regularly',
        'Collaborate with team members',
        'Deliver quality work within sprint timelines',
      ],
    },
  }

  const info = roleInfo[role]

  return (
    <Card className="bg-gray-50 border-gray-200">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-gray-600" />
          <CardTitle className="text-gray-900">Your Role: {info.title}</CardTitle>
        </div>
        <CardDescription className="text-gray-700">{info.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900">Key Responsibilities:</h4>
          <ul className="space-y-1">
            {info.responsibilities.map((responsibility, index) => (
              <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-gray-400 mt-1">•</span>
                {responsibility}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
