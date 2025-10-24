export interface ReadinessEvaluation {
  score: number
  missingItems: string[]
  recommendations: string[]
  summary: string
  isReady: boolean
}

export interface PlanPack {
  id: string
  storyId: string
  acceptanceCriteriaMap: AcceptanceCriteriaMap
  proposedTasks: ProposedTask[]
  architectureImpact?: string
  risks: string[]
  unknowns: string[]
  createdAt: string
}

export interface AcceptanceCriteriaMap {
  storyId: string
  criteria: AcceptanceCriterionInfo[]
}

export interface AcceptanceCriterionInfo {
  acId: string
  given: string
  when: string
  then: string
}

export interface ProposedTask {
  title: string
  description: string
  acceptanceCriteriaRefs: string[]
  estimatedComplexity: 'Low' | 'Medium' | 'High'
}

export interface TaskPack {
  id: string
  taskId: string
  planPackId?: string
  objectives: string
  nonGoals: string[]
  storyContext: string
  acceptanceCriteriaCovered: AcceptanceCriterionCoverage[]
  constraints: TaskConstraints
  testPlan: TestPlan
  doNotList: DoNotList
  commitPlan: CommitPlan
  runInstructions: string[]
  markdownContent: string
  jsonContent: Record<string, any>
  createdAt: string
}

export interface AcceptanceCriterionCoverage {
  acId: string
  given: string
  when: string
  then: string
  testApproach: string
}

export interface TaskConstraints {
  filePaths: string[]
  portsToImplement: string[]
  dtosToCreate: string[]
  architectureNotes: string
}

export interface TestPlan {
  unitTests: string[]
  integrationTests: string[]
  contractTests: string[]
  coverageThreshold?: number
}

export interface DoNotList {
  forbiddenActions: string[]
  noShortcuts: string[]
  requiredPractices: string[]
}

export interface CommitPlan {
  commitMessageTemplate: string
  preCommitChecks: string[]
  branchNamingConvention?: string
}

export interface CreatePlanPackRequest {
  storyId: string
  acceptanceCriteriaMap: AcceptanceCriteriaMap
  architectureImpact?: string
}

export interface CreateTaskPackRequest {
  taskId: string
  planPackId?: string
  objectives: string
  constraints: TaskConstraints
}

export interface StoryAnalysis {
  storyId: string
  complexity: 'Low' | 'Medium' | 'High'
  risks: string[]
  suggestions: string[]
  estimatedPoints?: number
}

export interface TaskAnalysis {
  taskId: string
  complexity: 'Low' | 'Medium' | 'High'
  dependencies: string[]
  clarifications: string[]
  estimatedHours?: number
}
