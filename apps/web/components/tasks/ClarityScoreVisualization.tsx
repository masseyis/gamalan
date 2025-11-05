"use client"

import { useMemo, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { AlertCircle, CheckCircle2, Info, Lightbulb, XCircle } from "lucide-react"

const CLARITY_LEVEL_STYLES: Record<
  "poor" | "fair" | "good" | "excellent",
  { text: string; indicator: string }
> = {
  poor: { text: "text-red-600", indicator: "bg-red-500" },
  fair: { text: "text-amber-600", indicator: "bg-amber-500" },
  good: { text: "text-blue-600", indicator: "bg-blue-500" },
  excellent: { text: "text-emerald-600", indicator: "bg-emerald-500" },
}

const READINESS_ITEMS: Array<{
  key: keyof AiReadinessChecklist
  label: string
  guidanceLabel: string
}> = [
  {
    key: "successCriteria",
    label: "Clear success criteria",
    guidanceLabel: "Define explicit success criteria for the agent to verify completion.",
  },
  {
    key: "dependencies",
    label: "Explicit dependencies",
    guidanceLabel: "List upstream dependencies or feature flags that must be enabled.",
  },
  {
    key: "environmentSetup",
    label: "Environment setup",
    guidanceLabel: "Document required environment setup scripts and secrets.",
  },
  {
    key: "testCoverage",
    label: "Expected test coverage",
    guidanceLabel: "Specify expected automated and manual test coverage.",
  },
  {
    key: "definitionOfDone",
    label: "Definition of done",
    guidanceLabel: "Clarify definition of done items such as documentation or demos.",
  },
]

type ClarityLevel = "poor" | "fair" | "good" | "excellent"

export interface ClarityScoreDimension {
  id: string
  label: string
  score: number
  weight: number
  summary: string
  recommendations: string[]
  tooltip: string
}

export interface FlaggedTerm {
  term: string
  context: string
  recommendation: string
}

export interface MissingAcceptanceCriteria {
  ids: string[]
  recommendation: string
}

export interface AiReadinessChecklist {
  successCriteria: boolean
  dependencies: boolean
  environmentSetup: boolean
  testCoverage: boolean
  definitionOfDone: boolean
  guidance: string[]
}

export interface EnrichmentSuggestion {
  summary: string
  confidence: number
  recommendedUpdates: string[]
}

export interface TaskClarityExample {
  title: string
  description: string
  source: string
  applyLabel?: string
}

export interface ClarityScoreVisualizationProps {
  taskId: string
  className?: string
  clarityScore: {
    score: number
    level: ClarityLevel
    dimensions: ClarityScoreDimension[]
  }
  flaggedTerms?: FlaggedTerm[]
  missingAcceptanceCriteria?: MissingAcceptanceCriteria
  aiReadiness?: AiReadinessChecklist
  enrichmentSuggestion?: EnrichmentSuggestion
  examples?: TaskClarityExample[]
  onReviewSuggestion?: () => void
  onApplyExample?: (example: TaskClarityExample) => void
}

const formatPercentage = (value: number) => `${Math.round(value)}%`

export function ClarityScoreVisualization({
  clarityScore,
  flaggedTerms = [],
  missingAcceptanceCriteria,
  aiReadiness,
  enrichmentSuggestion,
  examples = [],
  onReviewSuggestion,
  onApplyExample,
  className,
}: ClarityScoreVisualizationProps) {
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null)

  const levelStyles = CLARITY_LEVEL_STYLES[clarityScore.level]

  const readinessGuidanceMap = useMemo(() => {
    if (!aiReadiness) return new Map<string, string>()
    const map = new Map<string, string>()
    // Merge supplied guidance with default copy so we always surface the spec text
    for (const item of READINESS_ITEMS) {
      const provided = aiReadiness.guidance.find((entry) => entry.toLowerCase().includes(item.label.split(" ")[0].toLowerCase()))
      map.set(item.key, provided ?? item.guidanceLabel)
    }
    return map
  }, [aiReadiness])

  return (
    <TooltipProvider>
      <section
        className={cn("space-y-6", className)}
        aria-label="Task clarity score visualization"
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-4">
              <span>Clarity Score</span>
              <Badge variant="outline" className={cn("text-sm", levelStyles.text)}>
                {clarityScore.level.charAt(0).toUpperCase() + clarityScore.level.slice(1)}
              </Badge>
            </CardTitle>
            <CardDescription>
              Gauge showing how well-defined the task is based on technical detail, specificity, completeness, and testability.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "flex h-16 w-16 items-center justify-center rounded-full border-4 font-semibold",
                    levelStyles.indicator,
                    "text-white"
                  )}
                  aria-hidden="true"
                >
                  {clarityScore.score}
                </div>
                <div className="min-w-0">
                  <Progress
                    role="progressbar"
                    aria-label="Clarity score"
                    aria-valuenow={clarityScore.score}
                    value={clarityScore.score}
                    className="h-3 min-w-[12rem]"
                  />
                  <div className="mt-1 text-sm text-muted-foreground">
                    Combined clarity score across all dimensions
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {clarityScore.dimensions.map((dimension) => (
                <Tooltip key={dimension.id}>
                  <TooltipTrigger asChild>
                    <div
                      data-testid={`clarity-dimension-${dimension.id}`}
                      className="rounded-lg border border-border bg-muted/40 p-4 transition hover:border-foreground/30"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <h3 className="text-sm font-semibold leading-tight text-foreground">
                            {dimension.label}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Weight: {formatPercentage(dimension.weight * 100)}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-sm">
                          {dimension.score}
                        </Badge>
                      </div>

                      <p className="mt-3 text-sm text-muted-foreground">{dimension.summary}</p>

                      <div className="mt-4">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          aria-expanded={expandedDimension === dimension.id}
                          onClick={() =>
                            setExpandedDimension((current) =>
                              current === dimension.id ? null : dimension.id
                            )
                          }
                        >
                          {dimension.label}
                        </Button>

                        {expandedDimension === dimension.id && (
                          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-foreground">
                            {dimension.recommendations.map((item, index) => (
                              <li key={`${dimension.id}-recommendation-${index}`}>{item}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-left" side="top">
                    {dimension.tooltip}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </CardContent>
        </Card>

        {flaggedTerms.length > 0 && (
          <Card role="region" aria-labelledby="clarity-flagged-terms-heading">
            <CardHeader className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600" aria-hidden="true" />
                <CardTitle id="clarity-flagged-terms-heading">
                  Ambiguous language flagged
                </CardTitle>
              </div>
              <CardDescription>
                Terms that need more concrete language for AI task execution.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {flaggedTerms.map((term) => (
                <div key={term.term} className="space-y-2 rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="destructive">{term.term}</Badge>
                    <span className="text-sm text-muted-foreground">{term.context}</span>
                  </div>
                  <p className="text-sm text-foreground">{term.recommendation}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {missingAcceptanceCriteria && (
          <Card role="region" aria-labelledby="clarity-acceptance-heading">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-600" aria-hidden="true" />
                <CardTitle id="clarity-acceptance-heading">Acceptance Criteria Coverage</CardTitle>
              </div>
              <CardDescription>
                Ensure traceability by aligning the task with documented acceptance criteria.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {missingAcceptanceCriteria.ids.map((id) => (
                  <Badge key={id} variant="outline" className="font-mono">
                    {id}
                  </Badge>
                ))}
              </div>
              <p className="text-sm text-foreground">{missingAcceptanceCriteria.recommendation}</p>
            </CardContent>
          </Card>
        )}

        {aiReadiness && (
          <Card role="region" aria-labelledby="clarity-ai-readiness-heading">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-purple-600" aria-hidden="true" />
                <CardTitle id="clarity-ai-readiness-heading">AI agent readiness</CardTitle>
              </div>
              <CardDescription>
                Checklist required for an autonomous agent to execute this task reliably.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {READINESS_ITEMS.map(({ key, label }) => {
                const complete = aiReadiness[key]
                const kebab = label.replace(/\s+/g, "-").toLowerCase()
                return (
                  <div
                    key={key}
                    data-testid={`ai-readiness-${kebab}`}
                    data-status={complete ? "met" : "missing"}
                    className={cn(
                      "flex items-start gap-3 rounded-md border p-3 text-sm transition",
                      complete
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                        : "border-amber-200 bg-amber-50 text-amber-900"
                    )}
                  >
                    {complete ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    )}
                    <div className="space-y-1">
                      <div className="font-medium">{label}</div>
                      <p className="text-sm leading-snug text-current">
                        {readinessGuidanceMap.get(key) ?? "Add supporting guidance for this item."}
                      </p>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {enrichmentSuggestion && (
          <Card role="region" aria-labelledby="clarity-enrichment-heading">
            <CardHeader className="space-y-2">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-600" aria-hidden="true" />
                <CardTitle id="clarity-enrichment-heading">AI-assisted enrichment suggestion</CardTitle>
              </div>
              <CardDescription>
                Suggested improvements synthesized by the task clarity model.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <Badge variant="secondary" className="uppercase">
                  {formatPercentage(enrichmentSuggestion.confidence * 100)} confidence
                </Badge>
                <span>{enrichmentSuggestion.summary}</span>
              </div>

              <ul className="list-disc space-y-2 pl-5 text-sm text-foreground">
                {enrichmentSuggestion.recommendedUpdates.map((update, index) => (
                  <li key={`enrichment-update-${index}`}>{update}</li>
                ))}
              </ul>

              <Button type="button" onClick={onReviewSuggestion}>
                Review suggested update
              </Button>
            </CardContent>
          </Card>
        )}

        {examples.length > 0 && (
          <Card role="region" aria-labelledby="clarity-examples-heading">
            <CardHeader>
              <CardTitle id="clarity-examples-heading">Well-defined task examples</CardTitle>
              <CardDescription>
                Reference implementations that demonstrate the desired task structure.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {examples.map((example, index) => (
                <div
                  key={`${example.title}-${index}`}
                  className="rounded-md border border-border p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-semibold text-foreground">
                          {example.title}
                        </h4>
                        <Badge variant="secondary" className="text-xs uppercase">
                          {example.source}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{example.description}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onApplyExample?.(example)}
                    >
                      {example.applyLabel ?? "Apply example"}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>
    </TooltipProvider>
  )
}

